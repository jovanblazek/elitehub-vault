import type { Middleware } from 'koa'
import { Redis } from '../../utils/redis.js'
import logger from '../../utils/logger.js'
import { validateApiKey } from '../../auth/apiKeyValidator.js'
import { RedisSubscriptionManager } from './redisSubscriptionManager.js'
import { SseBroker } from './sseBroker.js'
import { parseSseSubscriptionQuery } from './subscriptionParams.js'
import { getRealtimeEventSpec, type RealtimeEventType } from './eventRegistry.js'

const redisSubscriber = Redis.duplicate()
const redisSubscriptions = new RedisSubscriptionManager(redisSubscriber, (event) => {
  sseBroker.routeEvent(event)
})
const sseBroker = new SseBroker(redisSubscriptions)

export const realtimeSseHandler: Middleware = async (ctx, next) => {
  if (ctx.path !== '/realtime/sse') {
    await next()
    return
  }

  if (ctx.method !== 'GET') {
    ctx.status = 405
    ctx.body = {
      error: 'Method Not Allowed',
      message: 'Use GET for SSE subscriptions',
    }
    return
  }

  const apiKey = ctx.headers['x-api-key']?.toString()
  const apiKeyResult = await validateApiKey(apiKey)

  if (!apiKeyResult.ok) {
    if (apiKeyResult.reason === 'internal_error') {
      ctx.status = 500
      ctx.body = {
        error: 'Internal Server Error',
        message: 'Failed to validate API key',
      }
      return
    }

    ctx.status = 401
    ctx.body = {
      error: 'Unauthorized',
      message: apiKeyResult.reason === 'missing' ? 'API key is required' : 'Invalid or inactive API key',
    }
    return
  }

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
      powerIds: query.data.powerIds,
      systemIds: query.data.systemIds,
    })
  } catch (error) {
    logger.error(error, '[SSE] Failed registering SSE connection')
    if (!response.writableEnded) {
      response.end()
    }
    return
  }

  const cleanup = () => {
    if (!connectionId) {
      return
    }

    const toCleanup = connectionId
    connectionId = null
    void sseBroker.cleanupConnection(toCleanup)
  }

  ctx.req.on('close', cleanup)
  response.on('close', cleanup)
  response.on('error', cleanup)
}

export const shutdownRealtimeSse = async () => {
  await sseBroker.closeAllConnections()
}
