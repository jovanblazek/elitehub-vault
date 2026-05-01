type OpenQuotaInput = {
  apiKeyId: string
  connectionLeaseId: string
  maxConnections: number
}

type OpenQuotaDecision = {
  ok: boolean
  active: number
  max: number
}

type TimeSource = () => number

const LEASE_TTL_MS = 90_000
const LEASE_TTL_SECONDS = Math.ceil(LEASE_TTL_MS / 1000)

const getLeaseKey = (apiKeyId: string) => `sse:leases:${apiKeyId}`

const ACQUIRE_SCRIPT = `
local leaseKey = KEYS[1]
local now = tonumber(ARGV[1])
local expiresAt = tonumber(ARGV[2])
local maxConnections = tonumber(ARGV[3])
local connectionLeaseId = ARGV[4]
local ttlSeconds = tonumber(ARGV[5])

redis.call('ZREMRANGEBYSCORE', leaseKey, '-inf', now)
local active = redis.call('ZCARD', leaseKey)
if active >= maxConnections then
  return {0, active, maxConnections}
end

redis.call('ZADD', leaseKey, expiresAt, connectionLeaseId)
redis.call('EXPIRE', leaseKey, ttlSeconds)
return {1, active + 1, maxConnections}
`

const REFRESH_SCRIPT = `
local leaseKey = KEYS[1]
local now = tonumber(ARGV[1])
local expiresAt = tonumber(ARGV[2])
local connectionLeaseId = ARGV[3]
local ttlSeconds = tonumber(ARGV[4])

redis.call('ZREMRANGEBYSCORE', leaseKey, '-inf', now)

if redis.call('ZSCORE', leaseKey, connectionLeaseId) == false then
  return 0
end

redis.call('ZADD', leaseKey, expiresAt, connectionLeaseId)
redis.call('EXPIRE', leaseKey, ttlSeconds)
return 1
`

const RELEASE_SCRIPT = `
local leaseKey = KEYS[1]
local connectionLeaseId = ARGV[1]

redis.call('ZREM', leaseKey, connectionLeaseId)
if redis.call('ZCARD', leaseKey) == 0 then
  redis.call('DEL', leaseKey)
end
return 1
`

export type SseLeaseRedisClient = {
  eval: (
    script: string,
    numKeys: number,
    key: string,
    ...args: Array<string | number>
  ) => Promise<unknown>
  keys?: (pattern: string) => Promise<string[]>
  del?: (...keys: string[]) => Promise<unknown>
}

type RedisSseConnectionLimiterOptions = {
  redisClient: SseLeaseRedisClient
  now?: TimeSource
}

export class RedisSseConnectionLimiter {
  private readonly activeByApiKey = new Map<string, number>()
  private activeTotal = 0
  private readonly redisClient: SseLeaseRedisClient
  private readonly now: TimeSource

  constructor({ redisClient, now = Date.now }: RedisSseConnectionLimiterOptions) {
    this.redisClient = redisClient
    this.now = now
  }

  async tryOpen(input: OpenQuotaInput): Promise<OpenQuotaDecision> {
    const now = this.now()
    const expiresAt = now + LEASE_TTL_MS
    const result = (await this.redisClient.eval(
      ACQUIRE_SCRIPT,
      1,
      getLeaseKey(input.apiKeyId),
      now,
      expiresAt,
      input.maxConnections,
      input.connectionLeaseId,
      LEASE_TTL_SECONDS
    )) as [number, number, number]

    return {
      ok: result[0] === 1,
      active: result[1],
      max: result[2],
    }
  }

  async refreshLease(apiKeyId: string, connectionLeaseId: string): Promise<boolean> {
    const now = this.now()
    const expiresAt = now + LEASE_TTL_MS
    const result = (await this.redisClient.eval(
      REFRESH_SCRIPT,
      1,
      getLeaseKey(apiKeyId),
      now,
      expiresAt,
      connectionLeaseId,
      LEASE_TTL_SECONDS
    )) as number

    return result === 1
  }

  async releaseLease(apiKeyId: string, connectionLeaseId: string) {
    await this.redisClient.eval(RELEASE_SCRIPT, 1, getLeaseKey(apiKeyId), connectionLeaseId)
  }

  async clearAllLeases() {
    if (!this.redisClient.keys || !this.redisClient.del) {
      throw new Error('Redis client does not support clearing SSE leases')
    }

    const keys = await this.redisClient.keys('sse:leases:*')
    if (keys.length === 0) {
      return
    }

    await this.redisClient.del(...keys)
  }

  onOpen(apiKeyId: string) {
    const active = this.activeByApiKey.get(apiKeyId) ?? 0
    this.activeByApiKey.set(apiKeyId, active + 1)
    this.activeTotal += 1
  }

  onClose(apiKeyId: string) {
    const active = this.activeByApiKey.get(apiKeyId) ?? 0
    if (active <= 0) {
      return
    }

    const next = active - 1
    if (next === 0) {
      this.activeByApiKey.delete(apiKeyId)
    } else {
      this.activeByApiKey.set(apiKeyId, next)
    }

    this.activeTotal = Math.max(0, this.activeTotal - 1)
  }

  getActiveConnectionsTotal() {
    return this.activeTotal
  }

  getActiveConnectionsByApiKey() {
    return Object.fromEntries(this.activeByApiKey.entries())
  }
}
