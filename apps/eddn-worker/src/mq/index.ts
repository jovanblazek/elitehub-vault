import logger from '../utils/logger.js'
import { createEddnWorker } from './queues/eddn/index.js'
import * as Sentry from '@sentry/node'

export const initMQ = () => {
  const bullMQWorkers = [createEddnWorker()]
  bullMQWorkers.forEach((worker) => {
    worker.on('failed', (job, error) => {
      if (job) {
        logger.error(new Error(job.failedReason), `[BullMQ] Job: ${job.name}:${job.id} - FAILED`)

        // Only capture to Sentry if max attempts reached (permanent failure)
        if (job.attemptsMade >= (job.opts.attempts || 3)) {
          Sentry.captureException(error, {
            tags: {
              component: 'bullmq-worker',
              event_type: 'job_failed_permanently',
              job_id: job.id || 'unknown',
            },
            contexts: {
              job: {
                id: job.id,
                name: job.name,
                attemptsMade: job.attemptsMade,
                maxAttempts: job.opts.attempts,
                failedReason: job.failedReason,
              },
            },
            level: 'error',
            fingerprint: ['bullmq', 'permanent_failure', job.name || 'unknown'],
          })
        }
      } else {
        logger.error(
          new Error('Unknown job failed'),
          `[BullMQ] Worker: ${worker.name} UNKNOWN JOB FAILED`
        )

        Sentry.captureMessage(`Unknown job failed in worker ${worker.name}`, {
          level: 'error',
          tags: {
            component: 'bullmq-worker',
            worker_name: worker.name,
          },
        })
      }
    })
    worker.on('error', (error) => {
      logger.error(error, `[BullMQ] Worker: ${worker.name} - ERROR`)
      Sentry.captureException(error, {
        tags: {
          component: 'bullmq-worker',
          worker_name: worker.name,
          error_type: 'worker_error',
        },
        level: 'error',
      })
    })
    worker.on('active', (job) => {
      logger.debug(job.data, `[BullMQ] Job: ${job.name}:${job.id} - ACTIVE`)
      Sentry.getCurrentScope().setContext('active_job', {
        id: job.id,
        name: job.name,
        event: job.data.message.event,
      })
    })
    worker.on('completed', (job) => {
      logger.debug(job.returnvalue, `[BullMQ] Job: ${job.name}:${job.id} - COMPLETED`)
      Sentry.getCurrentScope().setContext('active_job', null)
    })
    worker.on('closed', () => {
      logger.debug(`[BullMQ] Worker: ${worker.name} - CLOSED`)
      Sentry.addBreadcrumb({
        category: 'bullmq',
        message: `Worker ${worker.name} closed`,
        level: 'info',
      })
    })
  })

  return bullMQWorkers
}
