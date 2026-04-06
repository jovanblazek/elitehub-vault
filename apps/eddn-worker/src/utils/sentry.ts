import './environment.js'
import { initializeSentry } from '@elitehub/runtime-config'
import { env } from '../env.js'
import * as Sentry from '@sentry/node'
import packageJson from '../../package.json' with { type: 'json' }

initializeSentry({
  serviceName: 'eddn-worker',
  dsn: env.SENTRY_DSN_EDDN_WORKER,
  release: packageJson.version,
  integrations: [Sentry.postgresIntegration()],
})
