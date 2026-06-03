import * as Sentry from '@sentry/node'
import logger from './logger.js'
import { env } from './env.js'

const ENQUEUE_HEARTBEAT_INTERVAL_MS = 30_000
const ENQUEUE_HEARTBEAT_GAP_THRESHOLD_MS = 2 * 60_000
const ENQUEUE_STATUS_LOG_INTERVAL_MS = 60_000
const UPTIME_KUMA_PUSH_INTERVAL_MS = 30_000

type MonitorLogger = Pick<typeof logger, 'info' | 'warn' | 'error'>
type MonitorSentry = Pick<typeof Sentry, 'captureException' | 'captureMessage'>

type CreateEnqueueHeartbeatMonitorOptions = {
  heartbeatIntervalMs?: number
  timeSinceLastJobQueuedThresholdMs?: number
  statusLogIntervalMs?: number
  kumaPushIntervalMs?: number
  kumaPushUrl?: string
  fetch?: typeof globalThis.fetch
  logger?: MonitorLogger
  sentry?: MonitorSentry
}

export const createEnqueueHeartbeatMonitor = ({
  heartbeatIntervalMs = ENQUEUE_HEARTBEAT_INTERVAL_MS,
  timeSinceLastJobQueuedThresholdMs = ENQUEUE_HEARTBEAT_GAP_THRESHOLD_MS,
  statusLogIntervalMs = ENQUEUE_STATUS_LOG_INTERVAL_MS,
  kumaPushIntervalMs = UPTIME_KUMA_PUSH_INTERVAL_MS,
  kumaPushUrl = env.UPTIME_KUMA_PUSH_URL_EDDN_LISTENER,
  fetch = globalThis.fetch,
  logger: monitorLogger = logger,
  sentry = Sentry,
}: CreateEnqueueHeartbeatMonitorOptions = {}) => {
  let lastSuccessfulEnqueueAt = Date.now()
  let enqueueGapAlertOpen = false
  let hasSeenSuccessfulEnqueue = false
  let interval: NodeJS.Timeout | null = null
  let lastStatusLogAt = 0
  let lastKumaPushAt = 0

  const buildKumaPushUrl = (timeSinceLastJobQueuedMs: number) => {
    if (!kumaPushUrl) {
      return null
    }

    return kumaPushUrl.endsWith('ping=') ? `${kumaPushUrl}${timeSinceLastJobQueuedMs}` : kumaPushUrl
  }

  const pushUptimeKumaHeartbeat = async (now: number, timeSinceLastJobQueuedMs: number) => {
    const pushUrl = buildKumaPushUrl(timeSinceLastJobQueuedMs)

    if (
      !pushUrl ||
      !hasSeenSuccessfulEnqueue ||
      timeSinceLastJobQueuedMs >= timeSinceLastJobQueuedThresholdMs ||
      now - lastKumaPushAt < kumaPushIntervalMs
    ) {
      return
    }

    try {
      const response = await fetch(pushUrl, {
        method: 'GET',
      })

      if (!response.ok) {
        throw new Error(`Unexpected response status ${response.status}`)
      }

      lastKumaPushAt = now
    } catch (error) {
      monitorLogger.error(error, '[EDDN Listener] Uptime Kuma heartbeat push failed')
      sentry.captureException(error, {
        tags: {
          component: 'eddn-listener',
          error_type: 'uptime_kuma_heartbeat',
        },
      })
    }
  }

  const monitorEnqueueHeartbeat = async () => {
    const now = Date.now()
    const timeSinceLastJobQueuedMs = now - lastSuccessfulEnqueueAt

    if (now - lastStatusLogAt >= statusLogIntervalMs) {
      monitorLogger.info(
        {
          timeSinceLastJobQueuedMs,
          timeSinceLastJobQueuedThresholdMs,
          hasSeenSuccessfulEnqueue,
        },
        '[EDDN Listener] Heartbeat'
      )
      lastStatusLogAt = now
    }

    await pushUptimeKumaHeartbeat(now, timeSinceLastJobQueuedMs)

    if (timeSinceLastJobQueuedMs >= timeSinceLastJobQueuedThresholdMs && !enqueueGapAlertOpen) {
      enqueueGapAlertOpen = true

      monitorLogger.warn(
        {
          timeSinceLastJobQueuedMs,
          timeSinceLastJobQueuedThresholdMs,
        },
        '[EDDN Listener] No jobs enqueued recently'
      )

      sentry.captureMessage('EDDN listener enqueue heartbeat gap detected', {
        level: 'warning',
        tags: {
          component: 'eddn-listener',
          alert_type: 'enqueue_heartbeat_gap',
        },
        extra: {
          timeSinceLastJobQueuedMs,
          timeSinceLastJobQueuedThresholdMs,
        },
      })
    }

    if (timeSinceLastJobQueuedMs < timeSinceLastJobQueuedThresholdMs && enqueueGapAlertOpen) {
      enqueueGapAlertOpen = false

      monitorLogger.info(
        {
          timeSinceLastJobQueuedMs,
          timeSinceLastJobQueuedThresholdMs,
        },
        '[EDDN Listener] Enqueue heartbeat recovered'
      )

      sentry.captureMessage('EDDN listener enqueue heartbeat recovered', {
        level: 'info',
        tags: {
          component: 'eddn-listener',
          alert_type: 'enqueue_heartbeat_gap_recovered',
        },
        extra: {
          timeSinceLastJobQueuedMs,
          timeSinceLastJobQueuedThresholdMs,
        },
      })
    }
  }

  return {
    markEnqueueSuccess: () => {
      lastSuccessfulEnqueueAt = Date.now()
      hasSeenSuccessfulEnqueue = true
    },
    start: () => {
      const now = Date.now()
      lastStatusLogAt = now
      lastKumaPushAt = now
      interval = setInterval(() => {
        void monitorEnqueueHeartbeat()
      }, heartbeatIntervalMs)
      interval.unref()
      void monitorEnqueueHeartbeat()
    },
    stop: () => {
      if (interval) {
        clearInterval(interval)
        interval = null
      }
    },
  }
}
