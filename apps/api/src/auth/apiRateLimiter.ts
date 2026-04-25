import crypto from 'node:crypto'
import type { Context } from 'koa'

type RateLimitHeaders = {
  limit: number
  remaining: number
  reset: number
  retryAfter?: number
}

type RateLimitDecision =
  | {
      ok: true
      headers: RateLimitHeaders
    }
  | {
      ok: false
      reason: 'rate_limited' | 'service_unavailable'
      headers?: RateLimitHeaders
    }

type ApiRateLimiterOptions = {
  redisClient?: SlidingWindowRedisClient
  now?: () => number
  createMemberId?: () => string
}

const ANONYMOUS_GRAPHQL_REQUESTS_PER_MINUTE = 30
const INVALID_API_KEY_ATTEMPTS_PER_MINUTE = 20
const SSE_CONNECT_ATTEMPTS_PER_MINUTE = 10
const WINDOW_SECONDS = 60
const WINDOW_MS = WINDOW_SECONDS * 1000
const KEY_TTL_SECONDS = WINDOW_SECONDS + 5

type SlidingWindowRedisClient = {
  eval: (
    script: string,
    numKeys: number,
    key: string,
    windowStart: number,
    now: number,
    limit: number,
    member: string,
    ttlSeconds: number
  ) => Promise<unknown>
}

const defaultRedisClient: SlidingWindowRedisClient = {
  eval: async (...args) => {
    const { Redis } = await import('../utils/redis.js')
    return Redis.eval(...args)
  },
}

type SlidingWindowResult = {
  allowed: boolean
  count: number
  oldestTimestampMs: number
}

const SLIDING_WINDOW_SCRIPT = `
local key = KEYS[1]
local windowStart = tonumber(ARGV[1])
local now = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]
local ttlSeconds = tonumber(ARGV[5])

redis.call('ZREMRANGEBYSCORE', key, '-inf', windowStart)

local count = redis.call('ZCARD', key)
if count >= limit then
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local oldestScore = tonumber(oldest[2]) or now
  return {0, count, oldestScore}
end

redis.call('ZADD', key, now, member)
redis.call('EXPIRE', key, ttlSeconds)

local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
local oldestScore = tonumber(oldest[2]) or now
return {1, count + 1, oldestScore}
`

const toHeaders = (
  slidingWindowResult: SlidingWindowResult,
  limit: number,
  now: number,
  includeRetryAfter = false
): RateLimitHeaders => {
  const resetAtMs = slidingWindowResult.oldestTimestampMs + WINDOW_MS
  const msBeforeReset = Math.max(resetAtMs - now, 0)

  const headers: RateLimitHeaders = {
    limit,
    remaining: slidingWindowResult.allowed ? Math.max(limit - slidingWindowResult.count, 0) : 0,
    reset: Math.ceil(resetAtMs / 1000),
  }

  if (includeRetryAfter) {
    headers.retryAfter = Math.max(1, Math.ceil(msBeforeReset / 1000))
  }

  return headers
}

export const applyRateLimitHeaders = (ctx: Context, headers: RateLimitHeaders) => {
  ctx.set('X-RateLimit-Limit', String(headers.limit))
  ctx.set('X-RateLimit-Remaining', String(headers.remaining))
  ctx.set('X-RateLimit-Reset', String(headers.reset))

  if (headers.retryAfter) {
    ctx.set('Retry-After', String(headers.retryAfter))
  }
}

export class ApiRateLimiter {
  private readonly redisClient: SlidingWindowRedisClient
  private readonly now: () => number
  private readonly createMemberId: () => string

  constructor({
    redisClient = defaultRedisClient,
    now = () => Date.now(),
    createMemberId = () => crypto.randomUUID(),
  }: ApiRateLimiterOptions = {}) {
    this.redisClient = redisClient
    this.now = now
    this.createMemberId = createMemberId
  }

  async consumeAnonymousGraphql(ipAddress: string): Promise<RateLimitDecision> {
    return this.consume(`graphql:anon:${ipAddress}`, ANONYMOUS_GRAPHQL_REQUESTS_PER_MINUTE)
  }

  async consumeAuthenticatedGraphql(apiKeyId: string, limit: number): Promise<RateLimitDecision> {
    return this.consume(`graphql:key:${apiKeyId}`, limit)
  }

  async consumeInvalidApiKeyAttempt(ipAddress: string): Promise<RateLimitDecision> {
    return this.consume(`auth:invalid:${ipAddress}`, INVALID_API_KEY_ATTEMPTS_PER_MINUTE)
  }

  async consumeSseConnect(apiKeyId: string): Promise<RateLimitDecision> {
    return this.consume(`sse:connect:${apiKeyId}`, SSE_CONNECT_ATTEMPTS_PER_MINUTE)
  }

  private async consume(key: string, limit: number): Promise<RateLimitDecision> {
    const now = this.now()
    const member = `${now}:${this.createMemberId()}`

    try {
      const result = (await this.redisClient.eval(
        SLIDING_WINDOW_SCRIPT,
        1,
        key,
        now - WINDOW_MS,
        now,
        limit,
        member,
        KEY_TTL_SECONDS
      )) as [number, number, number]

      const slidingWindowResult: SlidingWindowResult = {
        allowed: result[0] === 1,
        count: result[1],
        oldestTimestampMs: result[2],
      }

      if (slidingWindowResult.allowed) {
        return {
          ok: true,
          headers: toHeaders(slidingWindowResult, limit, now),
        }
      }

      return {
        ok: false,
        reason: 'rate_limited',
        headers: toHeaders(slidingWindowResult, limit, now, true),
      }
    } catch {
      return {
        ok: false,
        reason: 'service_unavailable',
      }
    }
  }
}

export const apiRateLimiter = new ApiRateLimiter()
