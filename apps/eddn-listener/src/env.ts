import { createEnv } from '@t3-oss/env-core'
import {
  baseServerEnvSchema,
  loadEnvironment,
  redisServerEnvSchema,
} from '@elitehub/runtime-config'
import { z } from 'zod'

loadEnvironment()
const isTestEnvironment = process.env.NODE_ENV === 'test'

export const env = createEnv({
  server: {
    ...baseServerEnvSchema,
    ...redisServerEnvSchema,
    UPTIME_KUMA_PUSH_URL_EDDN_LISTENER: z.url().optional(),
  },
  runtimeEnv: process.env,
  skipValidation: isTestEnvironment,
  emptyStringAsUndefined: true,
})
