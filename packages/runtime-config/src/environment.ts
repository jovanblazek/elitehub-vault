import { createEnv } from '@t3-oss/env-core'
import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

let isLoaded = false

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const packageRoot = path.resolve(currentDir, '..')
const workspaceRoot = path.resolve(packageRoot, '../..')
const defaultEnvPath = path.join(workspaceRoot, '.env')

export const loadEnvironment = () => {
  if (isLoaded) {
    return
  }

  dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || defaultEnvPath })
  isLoaded = true
}

loadEnvironment()
const isTestEnvironment = process.env.NODE_ENV === 'test'

export const baseServerEnvSchema = {
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.string().min(1).optional(),
  API_KEY_SECRET_PEPPER: z.string().min(32).optional(),
  SENTRY_DSN_API: z.url().optional(),
  SENTRY_DSN_EDDN_WORKER: z.url().optional(),
  SENTRY_DSN_EDDN_LISTENER: z.url().optional(),
} as const

export const redisServerEnvSchema = {
  REDIS_PORT: z.coerce.number().int().positive(),
  REDIS_PASSWORD: z.string().min(1).optional(),
  REDIS_HOST: z.string().min(1),
  REDIS_USERNAME: z.string().min(1).optional(),
} as const

export const postgresServerEnvSchema = {
  POSTGRES_PORT: z.coerce.number().int().positive().optional(),
  POSTGRES_USER: z.string().min(1).optional(),
  POSTGRES_PASSWORD: z.string().min(1).optional(),
  POSTGRES_DB_NAME: z.string().min(1).optional(),
  POSTGRES_CONNECTION_STRING: z.string().min(1),
} as const

export const env = createEnv({
  server: {
    ...baseServerEnvSchema,
    ...redisServerEnvSchema,
  },
  runtimeEnv: process.env,
  skipValidation: isTestEnvironment,
  emptyStringAsUndefined: true,
})
