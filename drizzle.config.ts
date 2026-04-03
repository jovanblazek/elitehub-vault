import { defineConfig } from 'drizzle-kit'
import './packages/runtime-config/src/environment.js'

export default defineConfig({
  out: './drizzle',
  dialect: 'postgresql',
  schema: './packages/db/src/schema.ts',

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
