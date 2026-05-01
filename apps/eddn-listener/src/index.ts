import './sentry.js'
import './environment.js'
import * as Sentry from '@sentry/node'
import { Queue } from 'bullmq'
import { Subscriber } from 'zeromq'
import zlib from 'zlib'
import { EDDN_URL, isSupportedEddnMessage, type EDDNJournalMessage } from '@elitehub/eddn-contracts'
import { createEddnQueueOptions, QueueNames } from '@elitehub/queue-contracts'
import { createEnqueueHeartbeatMonitor } from './enqueueHeartbeatMonitor.js'
import logger from './logger.js'
import { addToQueueOrThrow } from './queuePublisher.js'
import { startQueueMonitor } from './queueMonitor.js'
import { Redis } from './redis.js'

const queue = new Queue<EDDNJournalMessage>(QueueNames.eddn, createEddnQueueOptions(Redis))

let socket: Subscriber | null = null
let isShuttingDown = false
let stopQueueMonitor: (() => void) | null = null
const enqueueHeartbeatMonitor = createEnqueueHeartbeatMonitor()

const shutdown = async () => {
  if (isShuttingDown) {
    return
  }

  isShuttingDown = true
  logger.info('[EDDN Listener] Shutting down...')

  if (stopQueueMonitor) {
    stopQueueMonitor()
    stopQueueMonitor = null
  }

  enqueueHeartbeatMonitor.stop()

  socket?.close()
  await queue.close()
  await Redis.quit()
  await Sentry.close(1000)
  process.exit(0)
}

process.on('SIGTERM', () => {
  void shutdown()
})
process.on('SIGINT', () => {
  void shutdown()
})

const run = async () => {
  stopQueueMonitor = startQueueMonitor(queue)
  enqueueHeartbeatMonitor.start()

  socket = new Subscriber()
  socket.connect(EDDN_URL)
  socket.subscribe('')
  logger.info(`[EDDN Listener] Connected to EDDN at ${EDDN_URL}`)

  for await (const [src] of socket) {
    if (isShuttingDown) {
      break
    }

    try {
      const message: EDDNJournalMessage = JSON.parse(zlib.inflateSync(src).toString())
      if (!isSupportedEddnMessage(message)) {
        continue
      }

      if (!message.message.StarSystem) {
        continue
      }

      await addToQueueOrThrow(queue, message)
      enqueueHeartbeatMonitor.markEnqueueSuccess()
    } catch (error) {
      logger.error(error, '[EDDN Listener] Message processing failed')
      Sentry.captureException(error, {
        tags: {
          component: 'eddn-listener',
          error_type: 'message_processing',
        },
      })
    }
  }
}

void run().catch(async (error) => {
  logger.error(error, '[EDDN Listener] Fatal error')
  Sentry.captureException(error, {
    tags: {
      component: 'eddn-listener',
      error_type: 'fatal',
    },
    level: 'fatal',
  })
  await Sentry.close(1000)
  process.exit(1)
})
