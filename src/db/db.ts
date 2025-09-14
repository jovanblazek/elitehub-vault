import { drizzle } from 'drizzle-orm/node-postgres'

export const db = drizzle({
  connection: {
    connectionString: process.env.POSTGRES_CONNECTION_STRING,
    // ssl: true // TODO: Enable SSL
  },
})
