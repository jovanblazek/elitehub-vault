import { createEnv } from '@t3-oss/env-core'
import {
  baseServerEnvSchema,
  loadEnvironment,
  postgresServerEnvSchema,
  redisServerEnvSchema,
} from '@elitehub/runtime-config'
import { z } from 'zod'

loadEnvironment()

export const env = createEnv({
  server: {
    ...baseServerEnvSchema,
    ...redisServerEnvSchema,
    ...postgresServerEnvSchema,
    PORT: z.coerce.number().int().positive().default(3000),
    API_KEY: z.string().min(1).optional(),
    SSE_API_KEY: z.string().min(1).optional(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
})
