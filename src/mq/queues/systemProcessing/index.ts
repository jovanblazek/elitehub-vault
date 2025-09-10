import { Queue, Worker } from 'bullmq'
import type { EDDNEventToProcess } from '../../../types/eddn.js'
import { Redis } from '../../../utils/redis.js'
import { QueueNames } from '../../constants.js'

export const SystemProcessingQueue = new Queue(QueueNames.systemProcessing, {
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

export const SystemProcessingWorker = new Worker<EDDNEventToProcess>(
  QueueNames.systemProcessing,
  async (job) => {
    console.log('SystemProcessingWorker running')
  },
  { connection: Redis }
)
