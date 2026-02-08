import type { Context } from 'koa'
import type { AuthorizedApiKey } from '../../middleware/auth/requireApiKey.js'
import { Redis } from '../../utils/redis.js'
import logger from '../../utils/logger.js'
import { InMemorySseConnectionLimiter } from './connectionLimiter.js'
import { RedisSubscriptionManager } from './redisSubscriptionManager.js'
import { SseBroker, type SseCloseReason } from './sseBroker.js'
import { parseSseSubscriptionQuery } from './subscriptionParams.js'
import { getRealtimeEventSpec, type RealtimeEventType } from './eventRegistry.js'
import { SseMetrics } from './sseMetrics.js'
import { captureSseException } from './sseTelemetry.js'

const SUMMARY_INTERVAL_MS = 30_000

const sseMetrics = new SseMetrics()
const connectionLimiter = new InMemorySseConnectionLimiter()

const redisSubscriber = Redis.duplicate()
const redisSubscriptions = new RedisSubscriptionManager(
  redisSubscriber,
  (event) => {
    sseBroker.routeEvent(event)
  },
  {
    onRedisError: () => {
      sseMetrics.onRedisError()
    },
    onRedisDisconnect: () => {
      sseMetrics.onRedisDisconnect()
    },
    onRedisRecovered: (demandedPowers) => {
      logger.info({ demandedPowers }, '[SSE] Redis subscriber recovered')
    },
  }
)

const sseBroker = new SseBroker(redisSubscriptions, {
  onConnectionOpened: ({
    connectionId,
    apiKeyId,
    keyName,
    eventType,
    powerIdCount,
    systemIdCount,
    activeChannels,
  }) => {
    sseMetrics.onConnectionOpened()
    sseMetrics.setActiveChannels(activeChannels)
    sseMetrics.setActiveConnections(connectionLimiter.getActiveConnectionsTotal())
    logger.info(
      {
        connectionId,
        apiKeyId,
        keyName,
        eventType,
        powerIdCount,
        systemIdCount,
        activeChannels,
      },
      '[SSE] Connection opened'
    )
  },
  onConnectionClosed: ({ connectionId, apiKeyId, keyName, reason, activeChannels }) => {
    sseMetrics.onConnectionClosed()
    sseMetrics.setActiveChannels(activeChannels)
    sseMetrics.setActiveConnections(connectionLimiter.getActiveConnectionsTotal())
    logger.info(
      {
        connectionId,
        apiKeyId,
        keyName,
        reason,
        activeChannels,
      },
      '[SSE] Connection closed'
    )
  },
  onEventRouted: () => {
    sseMetrics.onEventRouted()
  },
  onEventDropped: () => {
    sseMetrics.onEventDropped()
  },
  onWriteError: () => {
    sseMetrics.onWriteError()
  },
})

const summaryInterval = setInterval(() => {
  const summary = sseMetrics.getSummary()
  const activeConnectionsByApiKey = connectionLimiter.getActiveConnectionsByApiKey()
  logger.info(
    {
      ...summary,
      activeConnectionsByApiKey,
    },
    '[SSE] Summary'
  )
}, SUMMARY_INTERVAL_MS)
summaryInterval.unref()

export const openRealtimeSseConnection = async (ctx: Context, apiKey: AuthorizedApiKey) => {
  const requestUrl = new URL(ctx.req.url ?? '', `http://${ctx.host}`)
  const query = parseSseSubscriptionQuery(requestUrl.searchParams)

  if (!query.success) {
    ctx.status = 400
    ctx.body = {
      error: 'Bad Request',
      message: query.error,
    }
    return
  }

  const eventSpec = getRealtimeEventSpec(query.data.eventType)
  if (!eventSpec) {
    ctx.status = 400
    ctx.body = {
      error: 'Bad Request',
      message: 'Unsupported eventType',
    }
    return
  }

  const quotaDecision = connectionLimiter.canOpen({
    apiKeyId: apiKey.apiKeyId,
    maxConnections: apiKey.maxSseConnections,
  })

  if (!quotaDecision.ok) {
    logger.warn(
      {
        apiKeyId: apiKey.apiKeyId,
        keyName: apiKey.keyName,
        activeConnections: quotaDecision.active,
        maxConnections: quotaDecision.max,
        reason: 'quota_exceeded',
      },
      '[SSE] Connection rejected'
    )
    ctx.status = 429
    ctx.body = {
      error: 'Too Many Requests',
      message: 'Max concurrent SSE connections reached for this API key',
    }
    return
  }

  connectionLimiter.onOpen(apiKey.apiKeyId)
  sseMetrics.setActiveConnections(connectionLimiter.getActiveConnectionsTotal())

  let quotaReleased = false
  const releaseQuota = () => {
    if (quotaReleased) {
      return
    }

    quotaReleased = true
    connectionLimiter.onClose(apiKey.apiKeyId)
    sseMetrics.setActiveConnections(connectionLimiter.getActiveConnectionsTotal())
  }

  ctx.respond = false
  ctx.req.socket.setTimeout(0)
  ctx.req.socket.setKeepAlive(true)

  const response = ctx.res
  response.statusCode = 200
  response.setHeader('Content-Type', 'text/event-stream')
  response.setHeader('Cache-Control', 'no-cache')
  response.setHeader('Connection', 'keep-alive')
  response.setHeader('X-Accel-Buffering', 'no')
  response.flushHeaders()

  let connectionId: string | null = null
  try {
    connectionId = await sseBroker.registerConnection({
      response,
      eventType: eventSpec.eventType as RealtimeEventType,
      apiKeyId: apiKey.apiKeyId,
      keyName: apiKey.keyName,
      powerIds: query.data.powerIds,
      systemIds: query.data.systemIds,
    })
  } catch (error) {
    releaseQuota()
    captureSseException(error, {
      component: 'sse-service',
      tags: {
        operation: 'connect_register',
        event_type: query.data.eventType,
        error_type: 'register_failed',
      },
      contexts: {
        sse_connection: {
          apiKeyId: apiKey.apiKeyId,
          eventType: query.data.eventType,
          powerIdCount: query.data.powerIds.length,
          systemIdCount: query.data.systemIds?.length ?? 0,
        },
      },
      fingerprint: ['sse', 'connect', 'register_failed'],
    })
    logger.error(error, '[SSE] Failed registering SSE connection')
    if (!response.writableEnded) {
      response.end()
    }
    return
  }

  const cleanup = (reason: SseCloseReason) => {
    releaseQuota()
    if (!connectionId) {
      return
    }

    const toCleanup = connectionId
    connectionId = null
    void sseBroker.cleanupConnection(toCleanup, reason)
  }

  ctx.req.on('close', () => cleanup('client_disconnect'))
  response.on('close', () => cleanup('client_disconnect'))
  response.on('error', () => cleanup('write_error'))
}

export const shutdownRealtimeSse = async () => {
  clearInterval(summaryInterval)
  await sseBroker.closeAllConnections()
}
