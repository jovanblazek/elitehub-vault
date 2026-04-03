import pino from 'pino'
import { env } from './environment.js'

export const createLogger = () => {
  const isProduction = env.NODE_ENV === 'production'

  return pino({
    level: env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
    enabled: env.NODE_ENV !== 'test',
    transport: {
      targets: [
        {
          target: 'pino-pretty',
          level: 'debug',
          options: {
            colorize: true,
            translateTime: `UTC:yyyy-mm-dd'T'HH:MM:ss'Z'`,
            singleLine: true,
          },
        },
      ],
    },
  })
}
