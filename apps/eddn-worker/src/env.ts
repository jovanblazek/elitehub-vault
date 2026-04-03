import { createEnv } from '@t3-oss/env-core'
import {
  baseServerEnvSchema,
  loadEnvironment,
  postgresServerEnvSchema,
  redisServerEnvSchema,
} from '@elitehub/runtime-config'

loadEnvironment()

export const env = createEnv({
  server: {
    ...baseServerEnvSchema,
    ...redisServerEnvSchema,
    ...postgresServerEnvSchema,
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
})
