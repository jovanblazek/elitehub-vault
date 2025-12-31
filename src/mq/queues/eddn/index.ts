import { Queue, Worker } from 'bullmq'
import { Redis } from '../../../utils/redis.js'
import { QueueNames } from '../../constants.js'
import type { EDDNJournalMessage } from '../../../eddn/types.js'
import logger from '../../../utils/logger.js'
import { processFSDJumpEvent } from './events/fsdJump.js'
import { processLocationEvent } from './events/location.js'
import { processDockedEvent } from './events/docked.js'
import * as Sentry from '@sentry/node'

export const EDDNQueue = new Queue(QueueNames.eddn, {
  connection: Redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: true,
    removeOnFail: true,
  },
})

export const EDDNWorker = new Worker<EDDNJournalMessage>(
  QueueNames.eddn,
  async (job) => {
    // Set job context for this transaction
    return await Sentry.startSpan(
      {
        op: 'queue.process',
        name: `Process ${job.data.message.event}`,
        attributes: {
          'job.id': job.id || 'unknown',
          'job.name': job.name || 'unknown',
          'job.attempt': job.attemptsMade,
        },
      },
      async () => {
        try {
          const { event } = job.data.message
          Sentry.addBreadcrumb({
            category: 'bullmq',
            message: `Processing job ${job.name}`,
            level: 'info',
            data: {
              event,
              attempt: job.attemptsMade,
            },
          })

          switch (event) {
            case 'FSDJump':
              return processFSDJumpEvent(job.data.message)
            case 'Docked':
              return processDockedEvent(job.data.message)
            case 'Location':
              return processLocationEvent(job.data.message)
            // case 'CarrierJump':
            //   return processCarrierJumpEvent(job.data.message)
            default:
              logger.warn({ event }, '[EDDNWorker] Unknown event type')
          }
        } catch (error) {
          logger.error(error, '[EDDNWorker] Error processing job')

          // Capture to Sentry with job context
          Sentry.captureException(error, {
            tags: {
              component: 'bullmq-worker',
              event_type: job.data.message.event,
              job_id: job.id || 'unknown',
            },
            contexts: {
              job: {
                id: job.id,
                name: job.name,
                event: job.data.message.event,
              },
            },
            fingerprint: ['bullmq', job.data.message.event, (error as Error).message],
          })

          // Throw regular error to be caught by BullMQ
          // Docs: The exceptions thrown in a processor must be an Error object for BullMQ to work correctly.
          throw new Error(
            `Failed to process EDDN job, event: ${job?.data?.message?.event ?? 'Unknown event'}`,
            { cause: error }
          )
        }
      }
    )
  },
  { connection: Redis }
)
