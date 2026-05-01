import * as Sentry from '@sentry/node'
import { env } from './environment.js'

type InitializeSentryOptions = {
  serviceName: string
  dsn: string | undefined
  release?: string
  integrations?: ReturnType<typeof Sentry.koaIntegration>[]
}

export const initializeSentry = ({
  serviceName,
  dsn,
  release,
  integrations = [],
}: InitializeSentryOptions) => {
  const isProduction = env.NODE_ENV === 'production'

  if (Sentry.getClient()) {
    return
  }

  Sentry.init({
    enabled: isProduction,
    dsn,
    release,
    environment: env.NODE_ENV,
    serverName: serviceName,
    initialScope: {
      tags: {
        service: serviceName,
      },
    },
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
    integrations,
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
