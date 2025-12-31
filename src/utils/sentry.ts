import * as Sentry from '@sentry/node'
import './environment.js'

const IS_PRODUCTION = process.env.NODE_ENV === 'production'

Sentry.init({
  enabled: IS_PRODUCTION, // Enable Sentry in production only
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  tracesSampler: ({ attributes, inheritOrSampleWith }) => {
    if (!IS_PRODUCTION) {
      if (attributes?.['sentry.op'] === 'queue.process') {
        return 0.03
      }
      return inheritOrSampleWith(1)
    }

    // Queue processes many same-ish events, no need to sample all of them
    if (attributes?.['sentry.op'] === 'queue.process') {
      return 0.03
    }
    return inheritOrSampleWith(0.2)
  },
  integrations: [Sentry.koaIntegration(), Sentry.postgresIntegration()],
  sendDefaultPii: true,
  beforeSend(event) {
    // Filter out API keys from breadcrumbs and context
    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => {
        if (breadcrumb.data?.['x-api-key']) {
          breadcrumb.data['x-api-key'] = '[REDACTED]'
        }
        return breadcrumb
      })
    }

    // Filter sensitive headers
    if (event.request?.headers) {
      if (event.request.headers['x-api-key']) {
        event.request.headers['x-api-key'] = '[REDACTED]'
      }
    }

    return event
  },
  // Ignore specific errors
  ignoreErrors: [
    // Rate limiting errors (expected in normal operation)
    'rate_limit_exceeded',
    // Validation errors (user input issues, not bugs)
    'ZodError',
  ],
})
