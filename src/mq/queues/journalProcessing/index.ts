import { Queue, Worker } from 'bullmq'
import { Redis } from '../../../utils/redis.js'
import { QueueNames } from '../../constants.js'
import type { EDDNJournalMessage } from '../../../eddn/types.js'
import logger from '../../../utils/logger.js'
import { processFSDJumpEvent } from './events/fsdJump.js'

export const JournalProcessingQueue = new Queue(QueueNames.journalProcessing, {
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

export const JournalProcessingWorker = new Worker<EDDNJournalMessage>(
  QueueNames.journalProcessing,
  async (job) => {
    console.log('JournalProcessingWorker running')

    const { event } = job.data.message

    switch (event) {
      case 'FSDJump':
        return processFSDJumpEvent(job.data.message)
      // case 'Location':
      //   return processLocationEvent(job.data.message)
      // case 'CarrierJump':
      //   return processCarrierJumpEvent(job.data.message)
      default:
        logger.warn(`[JournalProcessingWorker] Unknown event type: ${event}`)
    }
  },
  { connection: Redis }
)
