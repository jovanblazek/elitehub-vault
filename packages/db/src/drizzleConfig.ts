import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config as loadDotenv } from 'dotenv'
import type { Config } from 'drizzle-kit'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
export const packageRoot = path.resolve(currentDir, '..')
const workspaceRoot = path.resolve(currentDir, '../../..')

loadDotenv({ path: path.join(workspaceRoot, '.env') })

export const drizzleConfig = {
  out: './drizzle',
  dialect: 'postgresql',
  schema: './src/schema.ts',
  dbCredentials: {
    url: process.env.POSTGRES_CONNECTION_STRING!,
  },
  migrations: {
    prefix: 'timestamp',
    table: '__drizzle_migrations__',
    schema: 'public',
  },
  casing: 'camelCase',
  strict: true,
} satisfies Config
