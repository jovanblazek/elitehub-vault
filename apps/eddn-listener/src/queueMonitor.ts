import * as Sentry from '@sentry/node'
import type { Queue } from 'bullmq'
import type { EDDNJournalMessage } from '@elitehub/eddn-contracts'
import { QueueNames } from '@elitehub/queue-contracts'
import logger from './logger.js'

const QUEUE_MONITOR_INTERVAL_MS = 60_000
const WAITING_JOBS_ALERT_THRESHOLD = 1000 // High number to avoid alerting during deployments when worker is offline for a few minutes

export const startQueueMonitor = (queue: Queue<EDDNJournalMessage>) => {
  let backlogAlertOpen = false

  const getOldestWaitingJobAgeMs = async () => {
    const [oldestWaitingJob] = await queue.getWaiting(0, 0)
    if (!oldestWaitingJob) {
      return 0
    }

    return Math.max(0, Date.now() - oldestWaitingJob.timestamp)
  }

  const monitorQueueHealth = async () => {
    const counts = await queue.getJobCounts('waiting', 'active', 'delayed')
    const oldestWaitingJobAgeMs = counts.waiting ? await getOldestWaitingJobAgeMs() : 0

    logger.info(
      {
        queue: QueueNames.eddn,
        waiting: counts.waiting ?? 0,
        active: counts.active ?? 0,
        delayed: counts.delayed ?? 0,
        oldestWaitingJobAgeMs,
        waitingThreshold: WAITING_JOBS_ALERT_THRESHOLD,
      },
      '[EDDN Listener] Queue health'
    )

    const waiting = counts.waiting ?? 0

    if (waiting > WAITING_JOBS_ALERT_THRESHOLD && !backlogAlertOpen) {
      backlogAlertOpen = true
      Sentry.captureMessage('EDDN queue backlog threshold exceeded', {
        level: 'warning',
        tags: {
          component: 'eddn-listener',
          queue: QueueNames.eddn,
          alert_type: 'queue_backlog',
        },
        extra: {
          waiting,
          active: counts.active ?? 0,
          delayed: counts.delayed ?? 0,
          oldestWaitingJobAgeMs,
          waitingThreshold: WAITING_JOBS_ALERT_THRESHOLD,
        },
      })
    }

    if (waiting <= WAITING_JOBS_ALERT_THRESHOLD && backlogAlertOpen) {
      backlogAlertOpen = false
      Sentry.captureMessage('EDDN queue backlog recovered', {
        level: 'info',
        tags: {
          component: 'eddn-listener',
          queue: QueueNames.eddn,
          alert_type: 'queue_backlog_recovered',
        },
        extra: {
          waiting,
          active: counts.active ?? 0,
          delayed: counts.delayed ?? 0,
          oldestWaitingJobAgeMs,
          waitingThreshold: WAITING_JOBS_ALERT_THRESHOLD,
        },
      })
    }
  }

  const runMonitor = () => {
    void monitorQueueHealth().catch((error) => {
      logger.error(error, '[EDDN Listener] Queue health monitor failed')
      Sentry.captureException(error, {
        tags: {
          component: 'eddn-listener',
          error_type: 'queue_monitor',
        },
      })
    })
  }

  const interval = setInterval(runMonitor, QUEUE_MONITOR_INTERVAL_MS)
  interval.unref()
  runMonitor()

  return () => {
    clearInterval(interval)
  }
}
