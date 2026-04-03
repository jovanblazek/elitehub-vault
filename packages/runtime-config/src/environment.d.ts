declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production' | 'test'
      PORT: string
      LOG_LEVEL?: string
      SENTRY_DSN?: string

      // Postgres
      POSTGRES_PORT: string
      POSTGRES_USER: string
      POSTGRES_PASSWORD: string
      POSTGRES_DB_NAME: string
      POSTGRES_CONNECTION_STRING: string

      // Redis
      REDIS_PORT: string
      REDIS_USERNAME?: string
      REDIS_PASSWORD: string
      REDIS_HOST: string
    }
  }
}

// If this file has no import/export statements (i.e. is a script)
// convert it into a module by adding an empty export statement.
// oxlint-disable-next-line require-module-specifiers
export {}
