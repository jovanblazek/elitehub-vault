import { Queue, Worker } from 'bullmq'
import { Redis } from '../../../utils/redis.js'
import { QueueNames } from '../../constants.js'
import type { EDDNJournalMessage } from '../../../eddn/types.js'
import logger from '../../../utils/logger.js'
import { processFSDJumpEvent } from './events/fsdJump.js'
import { processLocationEvent } from './events/location.js'
import { processDockedEvent } from './events/docked.js'

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
    try {
      const { event } = job.data.message

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
          logger.warn(`[EDDNWorker] Unknown event type: ${event}`)
      }
    } catch (error) {
      logger.error(error, '[EDDNWorker] Error processing job')
      // Throw regular error to be caught by BullMQ
      // Docs: The exceptions thrown in a processor must be an Error object for BullMQ to work correctly.
      throw new Error(
        `Failed to process EDDN job, event: ${job?.data?.message?.event ?? 'Unknown event'}`,
        { cause: error }
      )
    }
  },
  { connection: Redis }
)
