declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production'

      // Postgres
      POSTGRES_PORT: string
      POSTGRES_USER: string
      POSTGRES_PASSWORD: string
      POSTGRES_DB_NAME: string
      POSTGRES_CONNECTION_STRING: string

      // Redis
      REDIS_PORT: string
      REDIS_PASSWORD: string
      REDIS_HOST: string
    }
  }
}

// If this file has no import/export statements (i.e. is a script)
// convert it into a module by adding an empty export statement.
export {}
