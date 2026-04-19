import { Redis } from '../../utils/redis.js'

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
local expiresAt = tonumber(ARGV[1])
local connectionLeaseId = ARGV[2]
local ttlSeconds = tonumber(ARGV[3])

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

export class RedisSseConnectionLimiter {
  private readonly activeByApiKey = new Map<string, number>()
  private activeTotal = 0

  async tryOpen(input: OpenQuotaInput): Promise<OpenQuotaDecision> {
    const now = Date.now()
    const expiresAt = now + LEASE_TTL_MS
    const result = (await Redis.eval(
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

  async refreshLease(apiKeyId: string, connectionLeaseId: string) {
    const expiresAt = Date.now() + LEASE_TTL_MS
    await Redis.eval(
      REFRESH_SCRIPT,
      1,
      getLeaseKey(apiKeyId),
      expiresAt,
      connectionLeaseId,
      LEASE_TTL_SECONDS
    )
  }

  async releaseLease(apiKeyId: string, connectionLeaseId: string) {
    await Redis.eval(RELEASE_SCRIPT, 1, getLeaseKey(apiKeyId), connectionLeaseId)
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
