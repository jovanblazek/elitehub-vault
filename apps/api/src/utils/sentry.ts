import './environment.js'
import * as Sentry from '@sentry/node'
import { initializeSentry } from '@elitehub/runtime-config'
import { env } from '../env.js'

initializeSentry({
  serviceName: 'api',
  dsn: env.SENTRY_DSN_API,
  release: env.SENTRY_RELEASE,
  integrations: [Sentry.koaIntegration(), Sentry.postgresIntegration()],
})
