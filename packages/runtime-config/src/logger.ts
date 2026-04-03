import pino from 'pino'

export const createLogger = () => {
  const isProduction = process.env.NODE_ENV === 'production'

  return pino({
    level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
    enabled: process.env.NODE_ENV !== 'test',
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
