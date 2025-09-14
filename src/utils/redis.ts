import { Redis as RedisClient } from 'ioredis'

const { REDIS_PORT, REDIS_USERNAME, REDIS_PASSWORD, REDIS_HOST } = process.env

export const Redis = new RedisClient({
  port: parseInt(REDIS_PORT, 10),
  password: REDIS_PASSWORD,
  host: REDIS_HOST,
  username: REDIS_USERNAME,
  maxRetriesPerRequest: null,
})
