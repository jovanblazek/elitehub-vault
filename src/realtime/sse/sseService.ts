import type { Context } from 'koa'
import { Redis } from '../../utils/redis.js'
import logger from '../../utils/logger.js'
import { RedisSubscriptionManager } from './redisSubscriptionManager.js'
import { SseBroker } from './sseBroker.js'
import { parseSseSubscriptionQuery } from './subscriptionParams.js'
import { getRealtimeEventSpec, type RealtimeEventType } from './eventRegistry.js'

const redisSubscriber = Redis.duplicate()
const redisSubscriptions = new RedisSubscriptionManager(redisSubscriber, (event) => {
  sseBroker.routeEvent(event)
})
const sseBroker = new SseBroker(redisSubscriptions)

export const openRealtimeSseConnection = async (ctx: Context) => {
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
