import './environment.js'
import { createRedisConnection } from '@elitehub/runtime-config'

export const Redis = createRedisConnection()
