import { createDb } from '@elitehub/db'
import { env } from '../env.js'

export const db = createDb({
  connectionString: env.POSTGRES_CONNECTION_STRING,
})
