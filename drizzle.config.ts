import { defineConfig } from 'drizzle-kit'
import './src/utils/environment.js'

export default defineConfig({
  out: './drizzle',
  dialect: 'postgresql',
  schema: './src/db/schema.ts',

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
