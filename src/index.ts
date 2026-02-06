import './utils/sentry.js'
import './utils/environment.js'
import * as Sentry from '@sentry/node'

import type { Worker } from 'bullmq'
import startEDDNListenerProcess from './eddn/eddn.js'
import { initMQ } from './mq/index.js'
import logger from './utils/logger.js'
import { Redis } from './utils/redis.js'
import Koa, { type Context } from 'koa'
import { pgl } from './postgraphile/pgl.js'
import { grafserv } from 'postgraphile/grafserv/koa/v2'
import { apiKeyAuth } from './middleware/apiKeyAuth.js'
import ratelimit from 'koa-ratelimit'
import bodyParser from 'koa-bodyparser'
import { eventOutboxRelay } from './realtime/eventOutboxRelay.js'

let eddnProcess: ReturnType<typeof startEDDNListenerProcess> | null = null
let BullMQWorkers: Worker[] = []

Redis.on('ready', async () => {
  logger.info('[Redis] Connection established')
  eventOutboxRelay.start()
  BullMQWorkers = initMQ()
  if (process.env.NODE_ENV === 'production' || process.env.DEBUG_EDDN_LISTENER === 'true') {
    eddnProcess = startEDDNListenerProcess()
  }
})

const KoaApp = new Koa()

Sentry.setupKoaErrorHandler(KoaApp)

KoaApp.use(
  ratelimit({
    whitelist: () => process.env.NODE_ENV === 'development',
    driver: 'redis',
    db: Redis as any, // ioredis is compatible but has type conflicts
    namespace: 'api-rate-limit',
    duration: 60 * 1000, // 1 minute
    max: 60,
    errorMessage: JSON.stringify({
      error: 'rate_limit_exceeded',
      message: 'Rate limit exceeded. Please try again later.',
    }),
    id: (ctx: Context) => ctx.headers['x-api-key']?.toString() || ctx.ip,
    headers: {
      remaining: 'X-RateLimit-Remaining',
      reset: 'X-RateLimit-Reset',
      total: 'X-RateLimit-Limit',
    },
  })
)

KoaApp.use(bodyParser())
KoaApp.use(apiKeyAuth)

const serv = pgl.createServ(grafserv)
serv.addTo(KoaApp, null)

KoaApp.listen(process.env.PORT, () => {
  logger.info(`[Koa] Server listening on port ${process.env.PORT!}`)
})

// Graceful shutdown
let isShuttingDown = false

const shutdown = async () => {
  if (isShuttingDown) {
    return
  }
  isShuttingDown = true

  logger.info('Shutting down...')

  // Close EDDN worker
  if (eddnProcess) {
    logger.info('[EDDN] Initiating worker shutdown')
    await eddnProcess.shutdown()
    logger.info('[EDDN] Worker terminated')
  }

  // Close BullMQ workers
  logger.info('[BullMQ] Closing workers...')
  await Promise.all(BullMQWorkers.map((worker) => worker.close()))
  logger.info('[BullMQ] All workers closed')

  logger.info('[EventOutboxRelay] Closing relay...')
  await eventOutboxRelay.stop()
  logger.info('[EventOutboxRelay] Relay closed')

  // Close Redis connection
  logger.info('[Redis] Closing connection...')
  await Redis.quit()
  logger.info('[Redis] Connection closed')

  // Close Koa server
  logger.info('[Koa] Closing server...')
  await new Promise<void>((resolve) => {
    KoaApp.listen().close(() => resolve())
  })
  logger.info('[Koa] Server closed')

  // Give time for connections to close
  await new Promise((resolve) => {
    setTimeout(resolve, 500)
  })

  // Flush Sentry events before exit
  try {
    logger.info('[Sentry] Flushing pending events...')
    await Sentry.close(2000)
    logger.info('[Sentry] Events flushed')
  } catch (error) {
    logger.error(error, '[Sentry] Error flushing events')
  }

  process.exit(0)
}

process.on('SIGTERM', () => {
  void shutdown()
})
process.on('SIGINT', () => {
  void shutdown()
})
