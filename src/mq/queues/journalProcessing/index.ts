import { Queue, Worker } from 'bullmq'
import type { EDDNEventToProcess } from '../../../types/eddn.js'
import { Redis } from '../../../utils/redis.js'
import { QueueNames } from '../../constants.js'

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

export const JournalProcessingWorker = new Worker<EDDNEventToProcess>(
  QueueNames.journalProcessing,
  async (job) => {
    console.log('JournalProcessingWorker running')
  },
  { connection: Redis }
)
