import './utils/sentry.js'
import './utils/environment.js'
import * as Sentry from '@sentry/node'
import { initMQ } from './mq/index.js'
import logger from './utils/logger.js'
import { Redis } from './utils/redis.js'

let bullMQWorkers = initMQ()
let isShuttingDown = false

Redis.on('ready', () => {
  logger.info('[Redis] Connection established')
})

const shutdown = async () => {
  if (isShuttingDown) {
    return
  }

  isShuttingDown = true
  logger.info('Shutting down...')

  logger.info('[BullMQ] Closing workers...')
  await Promise.all(bullMQWorkers.map((worker) => worker.close()))
  logger.info('[BullMQ] All workers closed')

  logger.info('[Redis] Closing connection...')
  await Redis.quit()
  logger.info('[Redis] Connection closed')

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
