import type { Queue } from 'bullmq'
import type { EDDNJournalMessage } from '@elitehub/eddn-contracts'
import { EDDN_JOURNAL_PROCESS_JOB_NAME } from '@elitehub/queue-contracts'

const QUEUE_ADD_TIMEOUT_MS = 10_000

export const addToQueueOrThrow = async (
  queue: Queue<EDDNJournalMessage>,
  message: EDDNJournalMessage
) => {
  const jobName = `${EDDN_JOURNAL_PROCESS_JOB_NAME}:${message.message.event}:${message.message.StarSystem}`
  let timeout: NodeJS.Timeout | null = null

  try {
    await Promise.race([
      queue.add(jobName, message),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          timeout = null
          reject(
            new Error(
              `[EDDN Listener] Timed out adding ${message.message.event} event for ${message.message.StarSystem} to queue after ${QUEUE_ADD_TIMEOUT_MS}ms`
            )
          )
        }, QUEUE_ADD_TIMEOUT_MS)

        timeout.unref()
      }),
    ])
  } finally {
    if (timeout) {
      clearTimeout(timeout)
    }
  }
}
