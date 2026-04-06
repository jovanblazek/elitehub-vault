import './environment.js'
import * as Sentry from '@sentry/node'
import { initializeSentry } from '@elitehub/runtime-config'
import packageJson from '../../package.json' with { type: 'json' }
import { env } from '../env.js'

initializeSentry({
  serviceName: 'api',
  dsn: env.SENTRY_DSN_API,
  release: packageJson.version,
  integrations: [Sentry.koaIntegration(), Sentry.postgresIntegration()],
})
