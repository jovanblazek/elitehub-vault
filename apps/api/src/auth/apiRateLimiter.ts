import type { Context } from 'koa'
import { RateLimiterRedis, type RateLimiterRes } from 'rate-limiter-flexible'
import { Redis } from '../utils/redis.js'

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
  redisClient?: typeof Redis
}

const ANONYMOUS_GRAPHQL_LIMIT = 30
const INVALID_API_KEY_ATTEMPT_LIMIT = 20
const SSE_CONNECT_LIMIT = 10
const WINDOW_SECONDS = 60

const isRateLimiterRes = (value: unknown): value is RateLimiterRes =>
  !!value &&
  typeof value === 'object' &&
  'msBeforeNext' in value &&
  'remainingPoints' in value &&
  'consumedPoints' in value

const toHeaders = (rateLimiterRes: RateLimiterRes, limit: number): RateLimitHeaders => ({
  limit,
  remaining: Math.max(rateLimiterRes.remainingPoints ?? limit - rateLimiterRes.consumedPoints, 0),
  reset: Math.ceil((Date.now() + rateLimiterRes.msBeforeNext) / 1000),
  retryAfter: Math.max(1, Math.ceil(rateLimiterRes.msBeforeNext / 1000)),
})

export const applyRateLimitHeaders = (ctx: Context, headers: RateLimitHeaders) => {
  ctx.set('X-RateLimit-Limit', String(headers.limit))
  ctx.set('X-RateLimit-Remaining', String(headers.remaining))
  ctx.set('X-RateLimit-Reset', String(headers.reset))

  if (headers.retryAfter) {
    ctx.set('Retry-After', String(headers.retryAfter))
  }
}

export class ApiRateLimiter {
  private readonly anonymousGraphqlLimiter: RateLimiterRedis
  private readonly invalidApiKeyLimiter: RateLimiterRedis
  private readonly sseConnectLimiter: RateLimiterRedis
  private readonly graphqlLimiterByLimit = new Map<number, RateLimiterRedis>()
  private readonly redisClient: typeof Redis

  constructor({ redisClient = Redis }: ApiRateLimiterOptions = {}) {
    this.redisClient = redisClient
    this.anonymousGraphqlLimiter = this.createLimiter('graphql:anon', ANONYMOUS_GRAPHQL_LIMIT)
    this.invalidApiKeyLimiter = this.createLimiter('auth:invalid', INVALID_API_KEY_ATTEMPT_LIMIT)
    this.sseConnectLimiter = this.createLimiter('sse:connect', SSE_CONNECT_LIMIT)
  }

  async consumeAnonymousGraphql(ipAddress: string): Promise<RateLimitDecision> {
    return this.consume(this.anonymousGraphqlLimiter, `graphql:anon:${ipAddress}`, ANONYMOUS_GRAPHQL_LIMIT)
  }

  async consumeAuthenticatedGraphql(apiKeyId: string, limit: number): Promise<RateLimitDecision> {
    const limiter = this.getGraphqlLimiter(limit)
    return this.consume(limiter, `graphql:key:${apiKeyId}`, limit)
  }

  async consumeInvalidApiKeyAttempt(ipAddress: string): Promise<RateLimitDecision> {
    return this.consume(this.invalidApiKeyLimiter, `auth:invalid:${ipAddress}`, INVALID_API_KEY_ATTEMPT_LIMIT)
  }

  async consumeSseConnect(apiKeyId: string): Promise<RateLimitDecision> {
    return this.consume(this.sseConnectLimiter, `sse:connect:${apiKeyId}`, SSE_CONNECT_LIMIT)
  }

  private getGraphqlLimiter(limit: number) {
    const existing = this.graphqlLimiterByLimit.get(limit)
    if (existing) {
      return existing
    }

    const created = this.createLimiter(`graphql:key:${limit}`, limit)
    this.graphqlLimiterByLimit.set(limit, created)
    return created
  }

  private createLimiter(keyPrefix: string, points: number) {
    return new RateLimiterRedis({
      storeClient: this.redisClient,
      keyPrefix,
      points,
      duration: WINDOW_SECONDS,
    })
  }

  private async consume(
    limiter: RateLimiterRedis,
    key: string,
    limit: number
  ): Promise<RateLimitDecision> {
    try {
      const result = await limiter.consume(key)
      return {
        ok: true,
        headers: toHeaders(result, limit),
      }
    } catch (error) {
      if (isRateLimiterRes(error)) {
        return {
          ok: false,
          reason: 'rate_limited',
          headers: toHeaders(error, limit),
        }
      }

      return {
        ok: false,
        reason: 'service_unavailable',
      }
    }
  }
}

export const apiRateLimiter = new ApiRateLimiter()
