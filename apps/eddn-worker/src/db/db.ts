import { createDb } from '@elitehub/db'
import { getRequiredEnv } from '@elitehub/runtime-config'

export const db = createDb({
  connectionString: getRequiredEnv('POSTGRES_CONNECTION_STRING'),
})
