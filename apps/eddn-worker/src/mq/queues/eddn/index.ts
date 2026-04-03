import { Queue, Worker } from 'bullmq'
import {
  createEddnQueueOptions,
  createEddnWorkerOptions,
  QueueNames,
} from '@elitehub/queue-contracts'
import type { EDDNJournalMessage } from '@elitehub/eddn-contracts'
import logger from '../../../utils/logger.js'
import { Redis } from '../../../utils/redis.js'
import { processFSDJumpEvent } from './events/fsdJump.js'
import { processLocationEvent } from './events/location.js'
import { processDockedEvent } from './events/docked.js'
import * as Sentry from '@sentry/node'

export const createEddnQueue = () =>
  new Queue<EDDNJournalMessage>(QueueNames.eddn, createEddnQueueOptions(Redis))

export const createEddnWorker = () =>
  new Worker<EDDNJournalMessage>(
    QueueNames.eddn,
    async (job) => {
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
              default:
                logger.warn({ event }, '[EDDNWorker] Unknown event type')
            }
          } catch (error) {
            logger.error(error, '[EDDNWorker] Error processing job')
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

            throw new Error(
              `Failed to process EDDN job, event: ${job?.data?.message?.event ?? 'Unknown event'}`,
              { cause: error }
            )
          }
        }
      )
    },
    createEddnWorkerOptions(Redis)
  )
