import * as Sentry from '@sentry/node'

type SseTelemetryComponent = 'sse-service' | 'sse-broker' | 'sse-redis-subscriptions'

type SseTelemetryCaptureOptions = {
  component: SseTelemetryComponent
  level?: 'info' | 'warning' | 'error'
  tags?: Record<string, string>
  contexts?: Record<string, Record<string, unknown>>
  fingerprint?: string[]
}

type SseTelemetryClient = {
  captureException: (
    error: unknown,
    options?: {
      level?: 'info' | 'warning' | 'error'
      tags?: Record<string, string>
      contexts?: Record<string, Record<string, unknown>>
      fingerprint?: string[]
    }
  ) => string
  captureMessage: (
    message: string,
    options?: {
      level?: 'info' | 'warning' | 'error'
      tags?: Record<string, string>
      contexts?: Record<string, Record<string, unknown>>
      fingerprint?: string[]
    }
  ) => string
  startSpan: <T>(
    options: { name: string; op: string; attributes?: Record<string, string | number | boolean> },
    callback: () => T | Promise<T>
  ) => T | Promise<T>
}

const DEFAULT_CLIENT: SseTelemetryClient = {
  captureException: (error, options) => Sentry.captureException(error, options),
  captureMessage: (message, options) => Sentry.captureMessage(message, options),
  startSpan: (options, callback) => Sentry.startSpan(options, callback),
}

let telemetryClient: SseTelemetryClient = DEFAULT_CLIENT

export const captureSseException = (error: unknown, options: SseTelemetryCaptureOptions) => {
  telemetryClient.captureException(error, {
    level: options.level ?? 'error',
    tags: {
      ...options.tags,
      component: options.component,
    },
    contexts: options.contexts,
    fingerprint: options.fingerprint,
  })
}

export const __setSseTelemetryClientForTests = (client: SseTelemetryClient | null) => {
  telemetryClient = client ?? DEFAULT_CLIENT
}
