import { createEnv } from '@t3-oss/env-core'
import {
  baseServerEnvSchema,
  loadEnvironment,
  postgresServerEnvSchema,
  redisServerEnvSchema,
} from '@elitehub/runtime-config'

loadEnvironment()
const isTestEnvironment = process.env.NODE_ENV === 'test'

export const env = createEnv({
  server: {
    ...baseServerEnvSchema,
    ...redisServerEnvSchema,
    ...postgresServerEnvSchema,
  },
  runtimeEnv: process.env,
  skipValidation: isTestEnvironment,
  emptyStringAsUndefined: true,
})
