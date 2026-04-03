import * as Sentry from '@sentry/node'

export const initializeSentry = () => {
  const isProduction = process.env.NODE_ENV === 'production'

  if (Sentry.getClient()) {
    return
  }

  Sentry.init({
    enabled: isProduction,
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
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
