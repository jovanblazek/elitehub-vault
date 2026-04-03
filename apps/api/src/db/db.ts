import { createDb } from '@elitehub/db'

export const db = createDb({
  connectionString: process.env.POSTGRES_CONNECTION_STRING,
})
