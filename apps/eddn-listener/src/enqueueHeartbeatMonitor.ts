import * as Sentry from '@sentry/node'
import logger from './logger.js'

const ENQUEUE_HEARTBEAT_INTERVAL_MS = 30_000
const ENQUEUE_HEARTBEAT_GAP_THRESHOLD_MS = 2 * 60_000

export const createEnqueueHeartbeatMonitor = () => {
  let lastSuccessfulEnqueueAt = Date.now()
  let enqueueGapAlertOpen = false
  let interval: NodeJS.Timeout | null = null

  const monitorEnqueueHeartbeat = () => {
    const now = Date.now()
    const enqueueGapMs = now - lastSuccessfulEnqueueAt

    if (enqueueGapMs >= ENQUEUE_HEARTBEAT_GAP_THRESHOLD_MS && !enqueueGapAlertOpen) {
      enqueueGapAlertOpen = true

      logger.warn(
        {
          enqueueGapMs,
          enqueueGapThresholdMs: ENQUEUE_HEARTBEAT_GAP_THRESHOLD_MS,
        },
        '[EDDN Listener] No jobs enqueued recently'
      )

      Sentry.captureMessage('EDDN listener enqueue heartbeat gap detected', {
        level: 'warning',
        tags: {
          component: 'eddn-listener',
          alert_type: 'enqueue_heartbeat_gap',
        },
        extra: {
          enqueueGapMs,
          enqueueGapThresholdMs: ENQUEUE_HEARTBEAT_GAP_THRESHOLD_MS,
        },
      })
    }

    if (enqueueGapMs < ENQUEUE_HEARTBEAT_GAP_THRESHOLD_MS && enqueueGapAlertOpen) {
      enqueueGapAlertOpen = false

      logger.info(
        {
          enqueueGapMs,
          enqueueGapThresholdMs: ENQUEUE_HEARTBEAT_GAP_THRESHOLD_MS,
        },
        '[EDDN Listener] Enqueue heartbeat recovered'
      )

      Sentry.captureMessage('EDDN listener enqueue heartbeat recovered', {
        level: 'info',
        tags: {
          component: 'eddn-listener',
          alert_type: 'enqueue_heartbeat_gap_recovered',
        },
        extra: {
          enqueueGapMs,
          enqueueGapThresholdMs: ENQUEUE_HEARTBEAT_GAP_THRESHOLD_MS,
        },
      })
    }
  }

  return {
    markEnqueueSuccess: () => {
      lastSuccessfulEnqueueAt = Date.now()
    },
    start: () => {
      interval = setInterval(monitorEnqueueHeartbeat, ENQUEUE_HEARTBEAT_INTERVAL_MS)
      interval.unref()
      monitorEnqueueHeartbeat()
    },
    stop: () => {
      if (interval) {
        clearInterval(interval)
        interval = null
      }
    },
  }
}
