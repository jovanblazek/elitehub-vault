import './environment.js'
import { initializeSentry } from '@elitehub/runtime-config'
import packageJson from '../package.json' with { type: 'json' }
import { env } from './env.js'

initializeSentry({
  serviceName: 'eddn-listener',
  dsn: env.SENTRY_DSN_EDDN_LISTENER,
  release: packageJson.version,
})
