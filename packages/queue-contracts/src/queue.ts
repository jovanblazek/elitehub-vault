import type { QueueOptions, WorkerOptions } from 'bullmq'
import type { EDDNJournalMessage } from '@elitehub/eddn-contracts'

export const QueueNames = {
  eddn: 'eddn',
} as const

export const EDDN_JOURNAL_PROCESS_JOB_NAME = 'journal-processing'

export type EddnJobPayload = EDDNJournalMessage

export const createEddnDefaultJobOptions = () => ({
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 1000,
  },
  removeOnComplete: true,
  removeOnFail: true,
})

export const createEddnQueueOptions = (connection: QueueOptions['connection']): QueueOptions => ({
  connection,
  defaultJobOptions: createEddnDefaultJobOptions(),
})

export const createEddnWorkerOptions = (
  connection: WorkerOptions['connection']
): WorkerOptions => ({
  connection,
})
