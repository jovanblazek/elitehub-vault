import { drizzle } from 'drizzle-orm/node-postgres'

export type DatabaseConnectionConfig = {
  connectionString: string
}

export type DbClient = ReturnType<typeof drizzle>

export const createDb = ({ connectionString }: DatabaseConnectionConfig): DbClient =>
  drizzle({
    connection: {
      connectionString,
    },
  })
