import { createEnv } from '@t3-oss/env-core'
import { baseServerEnvSchema, loadEnvironment, redisServerEnvSchema } from '@elitehub/runtime-config'

loadEnvironment()

export const env = createEnv({
  server: {
    ...baseServerEnvSchema,
    ...redisServerEnvSchema,
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
})
