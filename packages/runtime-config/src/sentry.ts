import * as Sentry from '@sentry/node'
import { env } from './environment.js'

export const initializeSentry = () => {
  const isProduction = env.NODE_ENV === 'production'

  if (Sentry.getClient()) {
    return
  }

  Sentry.init({
    enabled: isProduction,
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampler: ({ attributes, inheritOrSampleWith }) => {
      if (!isProduction) {
        if (attributes?.['sentry.op'] === 'queue.process') {
          return 0.03
        }
        return inheritOrSampleWith(1)
      }

      if (attributes?.['sentry.op'] === 'queue.process') {
        return 0.03
      }
      return inheritOrSampleWith(0.2)
    },
    integrations: [Sentry.koaIntegration(), Sentry.postgresIntegration()],
    sendDefaultPii: true,
    beforeSend(event) {
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => {
          if (breadcrumb.data?.['x-api-key']) {
            breadcrumb.data['x-api-key'] = '[REDACTED]'
          }
          return breadcrumb
        })
      }

      if (event.request?.headers && event.request.headers['x-api-key']) {
        event.request.headers['x-api-key'] = '[REDACTED]'
      }

      return event
    },
    ignoreErrors: ['rate_limit_exceeded', 'ZodError'],
  })
}
