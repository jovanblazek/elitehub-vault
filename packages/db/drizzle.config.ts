import { createEnv } from '@t3-oss/env-core'
import { defineConfig } from 'drizzle-kit'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config as loadDotenv } from 'dotenv'
import { z } from 'zod'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
export const packageRoot = path.resolve(currentDir)
const workspaceRoot = path.resolve(currentDir, '../../')

loadDotenv({ path: path.join(workspaceRoot, '.env') })

export const dbEnv = createEnv({
  server: {
    POSTGRES_CONNECTION_STRING: z.string().min(1),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
})

export default defineConfig({
  out: './drizzle',
  dialect: 'postgresql',
  schema: './src/schema.ts',
  dbCredentials: {
    url: dbEnv.POSTGRES_CONNECTION_STRING,
  },
  migrations: {
    prefix: 'timestamp',
    table: '__drizzle_migrations__',
    schema: 'public',
  },
  casing: 'camelCase',
  strict: true,
})
