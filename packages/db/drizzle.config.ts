import { defineConfig } from 'drizzle-kit'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config as loadDotenv } from 'dotenv'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
export const packageRoot = path.resolve(currentDir)
const workspaceRoot = path.resolve(currentDir, '../../')

loadDotenv({ path: path.join(workspaceRoot, '.env') })

export default defineConfig({
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
})
