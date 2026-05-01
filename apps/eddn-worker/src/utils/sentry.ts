import './environment.js'
import { initializeSentry } from '@elitehub/runtime-config'
import { env } from '../env.js'
import * as Sentry from '@sentry/node'

initializeSentry({
  serviceName: 'eddn-worker',
  dsn: env.SENTRY_DSN_EDDN_WORKER,
  release: env.SENTRY_RELEASE,
  integrations: [Sentry.postgresIntegration()],
})
