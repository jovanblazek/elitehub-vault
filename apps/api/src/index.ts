import './utils/sentry.js'
import './utils/environment.js'
import * as Sentry from '@sentry/node'

import bodyParser from 'koa-bodyparser'
import Koa from 'koa'
import { grafserv } from 'postgraphile/grafserv/koa/v2'
import { eventOutboxRelay } from './realtime/eventOutboxRelay.js'
import { routeAccessMiddleware } from './middleware/routeAccess.js'
import { pgl } from './postgraphile/pgl.js'
import { shutdownRealtimeSse } from './realtime/sse/sseService.js'
import { env } from './env.js'
import logger from './utils/logger.js'
import { Redis } from './utils/redis.js'

const koaApp = new Koa()
Sentry.setupKoaErrorHandler(koaApp)

koaApp.use(bodyParser())
koaApp.use(routeAccessMiddleware)

const serv = pgl.createServ(grafserv)
serv.addTo(koaApp, null)

const server = koaApp.listen(env.PORT, () => {
  logger.info(`[Koa] Server listening on port ${env.PORT}`)
})

Redis.on('ready', () => {
  logger.info('[Redis] Connection established')
  eventOutboxRelay.start()
})

let isShuttingDown = false

const shutdown = async () => {
  if (isShuttingDown) {
    return
  }

  isShuttingDown = true
  logger.info('Shutting down...')

  logger.info('[EventOutboxRelay] Closing relay...')
  await eventOutboxRelay.stop()
  logger.info('[EventOutboxRelay] Relay closed')

  logger.info('[SSE] Closing realtime SSE broker...')
  await shutdownRealtimeSse()
  logger.info('[SSE] Realtime SSE broker closed')

  logger.info('[Redis] Closing connection...')
  await Redis.quit()
  logger.info('[Redis] Connection closed')

  logger.info('[Koa] Closing server...')
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error)
        return
      }
      resolve()
    })
  })
  logger.info('[Koa] Server closed')

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
