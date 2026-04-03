import { Redis } from 'ioredis'
import { getRequiredEnv } from './environment.js'

export type RedisConfig = {
  port: number
  password?: string
  host: string
  username?: string
  maxRetriesPerRequest: null
}

export const getRedisConfig = (): RedisConfig => ({
  port: Number.parseInt(getRequiredEnv('REDIS_PORT'), 10),
  password: process.env.REDIS_PASSWORD,
  host: getRequiredEnv('REDIS_HOST'),
  username: process.env.REDIS_USERNAME,
  maxRetriesPerRequest: null,
})

export const createRedisConnection = () => new Redis(getRedisConfig())
