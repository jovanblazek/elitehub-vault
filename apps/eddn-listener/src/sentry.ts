import './environment.js'
import { initializeSentry } from '@elitehub/runtime-config'
import { env } from './env.js'

initializeSentry({
  serviceName: 'eddn-listener',
  dsn: env.SENTRY_DSN_EDDN_LISTENER,
})
