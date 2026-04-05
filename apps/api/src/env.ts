import { createEnv } from '@t3-oss/env-core'
import {
  baseServerEnvSchema,
  loadEnvironment,
  postgresServerEnvSchema,
  redisServerEnvSchema,
} from '@elitehub/runtime-config'
import { z } from 'zod'

loadEnvironment()
const isTestEnvironment = process.env.NODE_ENV === 'test'

export const env = createEnv({
  server: {
    ...baseServerEnvSchema,
    ...redisServerEnvSchema,
    ...postgresServerEnvSchema,
    PORT: z.coerce.number().int().positive().default(3000),
  },
  runtimeEnv: process.env,
  skipValidation: isTestEnvironment,
  emptyStringAsUndefined: true,
})
