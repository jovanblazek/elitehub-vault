import { Redis } from 'ioredis'
import { env } from './environment.js'

export type RedisConfig = {
  port: number
  password?: string
  host: string
  username?: string
  maxRetriesPerRequest: null
}

export const getRedisConfig = (): RedisConfig => ({
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD,
  host: env.REDIS_HOST,
  username: env.REDIS_USERNAME,
  maxRetriesPerRequest: null,
})

export const createRedisConnection = () => new Redis(getRedisConfig())
