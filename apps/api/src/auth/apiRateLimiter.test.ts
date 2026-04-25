import assert from 'node:assert/strict'
import test from 'node:test'
import { ApiRateLimiter } from './apiRateLimiter.js'

type Entry = {
  member: string
  score: number
}

class InMemorySlidingWindowRedis {
  private readonly entriesByKey = new Map<string, Entry[]>()
  failReads = false

  async eval(
    _script: string,
    _numKeys: number,
    key: string,
    windowStart: number,
    now: number,
    limit: number,
    member: string,
    _ttlSeconds: number
  ): Promise<[number, number, number]> {
    if (this.failReads) {
      throw new Error('redis unavailable')
    }

    const existing = (this.entriesByKey.get(key) ?? []).filter((entry) => entry.score > windowStart)
    existing.sort((left, right) => left.score - right.score)

    if (existing.length >= limit) {
      const oldestScore = existing[0]?.score ?? now
      this.entriesByKey.set(key, existing)
      return [0, existing.length, oldestScore]
    }

    existing.push({ member, score: now })
    existing.sort((left, right) => left.score - right.score)
    this.entriesByKey.set(key, existing)
    return [1, existing.length, existing[0]?.score ?? now]
  }

  getCount(key: string) {
    return this.entriesByKey.get(key)?.length ?? 0
  }
}

test('ApiRateLimiter accepts requests below the anonymous GraphQL limit and decrements remaining', async () => {
  const redis = new InMemorySlidingWindowRedis()
  let now = 1_000
  let memberId = 0
  const limiter = new ApiRateLimiter({
    redisClient: redis,
    now: () => now,
    createMemberId: () => `req-${++memberId}`,
  })

  const first = await limiter.consumeAnonymousGraphql('203.0.113.10')
  now += 1_000
  const second = await limiter.consumeAnonymousGraphql('203.0.113.10')

  assert.equal(first.ok, true)
  assert.equal(second.ok, true)
  assert.equal(first.ok && first.headers.limit, 30)
  assert.equal(first.ok && first.headers.remaining, 29)
  assert.equal(second.ok && second.headers.remaining, 28)
  assert.equal(first.ok && first.headers.retryAfter, undefined)
  assert.equal(second.ok && second.headers.retryAfter, undefined)
  assert.equal(redis.getCount('graphql:anon:203.0.113.10'), 2)
})

test('ApiRateLimiter blocks the first request beyond the rolling window limit', async () => {
  const redis = new InMemorySlidingWindowRedis()
  let now = 1_000
  let memberId = 0
  const limiter = new ApiRateLimiter({
    redisClient: redis,
    now: () => now,
    createMemberId: () => `req-${++memberId}`,
  })

  for (let index = 0; index < 30; index += 1) {
    // oxlint-disable-next-line no-await-in-loop
    const decision = await limiter.consumeAnonymousGraphql('198.51.100.1')
    assert.equal(decision.ok, true)
    now += 1
  }

  now = 59_001
  const blocked = await limiter.consumeAnonymousGraphql('198.51.100.1')

  assert.deepEqual(blocked, {
    ok: false,
    reason: 'rate_limited',
    headers: {
      limit: 30,
      remaining: 0,
      reset: 61,
      retryAfter: 2,
    },
  })
})

test('ApiRateLimiter allows a request after the oldest entry ages out of the sliding window', async () => {
  const redis = new InMemorySlidingWindowRedis()
  let now = 1_000
  let memberId = 0
  const limiter = new ApiRateLimiter({
    redisClient: redis,
    now: () => now,
    createMemberId: () => `req-${++memberId}`,
  })

  for (let index = 0; index < 30; index += 1) {
    // oxlint-disable-next-line no-await-in-loop
    const decision = await limiter.consumeAnonymousGraphql('192.0.2.25')
    assert.equal(decision.ok, true)
    now += 1
  }

  now = 61_001
  const allowed = await limiter.consumeAnonymousGraphql('192.0.2.25')

  assert.equal(allowed.ok, true)
  assert.equal(allowed.ok && allowed.headers.remaining, 1)
  assert.equal(allowed.ok && allowed.headers.reset, 62)
  assert.equal(allowed.ok && allowed.headers.retryAfter, undefined)
})

test('ApiRateLimiter does not allow fixed-window bursts across a minute boundary', async () => {
  const redis = new InMemorySlidingWindowRedis()
  let now = 59_990
  let memberId = 0
  const limiter = new ApiRateLimiter({
    redisClient: redis,
    now: () => now,
    createMemberId: () => `req-${++memberId}`,
  })

  for (let index = 0; index < 30; index += 1) {
    // oxlint-disable-next-line no-await-in-loop
    const decision = await limiter.consumeAnonymousGraphql('203.0.113.50')
    assert.equal(decision.ok, true)
  }

  now = 60_010
  const blocked = await limiter.consumeAnonymousGraphql('203.0.113.50')

  assert.equal(blocked.ok, false)
  assert.equal(blocked.ok ? -1 : blocked.reason, 'rate_limited')
  assert.equal(blocked.ok ? -1 : blocked.headers?.retryAfter, 60)
})

test('ApiRateLimiter isolates counters by API key for authenticated GraphQL', async () => {
  const redis = new InMemorySlidingWindowRedis()
  let now = 10_000
  let memberId = 0
  const limiter = new ApiRateLimiter({
    redisClient: redis,
    now: () => now,
    createMemberId: () => `req-${++memberId}`,
  })

  const firstKey = await limiter.consumeAuthenticatedGraphql('key-a', 2)
  const secondKey = await limiter.consumeAuthenticatedGraphql('key-b', 2)
  const sameKeySecond = await limiter.consumeAuthenticatedGraphql('key-a', 2)
  const blocked = await limiter.consumeAuthenticatedGraphql('key-a', 2)

  assert.equal(firstKey.ok, true)
  assert.equal(secondKey.ok, true)
  assert.equal(sameKeySecond.ok, true)
  assert.equal(blocked.ok, false)
  assert.equal(redis.getCount('graphql:key:key-a'), 2)
  assert.equal(redis.getCount('graphql:key:key-b'), 1)
})

test('ApiRateLimiter applies sliding-window limits to invalid API key attempts', async () => {
  const redis = new InMemorySlidingWindowRedis()
  let now = 100
  let memberId = 0
  const limiter = new ApiRateLimiter({
    redisClient: redis,
    now: () => now,
    createMemberId: () => `req-${++memberId}`,
  })

  for (let index = 0; index < 20; index += 1) {
    // oxlint-disable-next-line no-await-in-loop
    const decision = await limiter.consumeInvalidApiKeyAttempt('198.51.100.20')
    assert.equal(decision.ok, true)
  }

  const blocked = await limiter.consumeInvalidApiKeyAttempt('198.51.100.20')

  assert.equal(blocked.ok, false)
  assert.equal(blocked.ok ? -1 : blocked.headers?.limit, 20)
  assert.equal(blocked.ok ? -1 : blocked.headers?.remaining, 0)
})

test('ApiRateLimiter applies sliding-window limits to SSE connect attempts', async () => {
  const redis = new InMemorySlidingWindowRedis()
  let now = 5_000
  let memberId = 0
  const limiter = new ApiRateLimiter({
    redisClient: redis,
    now: () => now,
    createMemberId: () => `req-${++memberId}`,
  })

  for (let index = 0; index < 10; index += 1) {
    // oxlint-disable-next-line no-await-in-loop
    const decision = await limiter.consumeSseConnect('key-sse')
    assert.equal(decision.ok, true)
  }

  const blocked = await limiter.consumeSseConnect('key-sse')

  assert.equal(blocked.ok, false)
  assert.equal(blocked.ok ? -1 : blocked.headers?.limit, 10)
  assert.equal(blocked.ok ? -1 : blocked.headers?.remaining, 0)
})

test('ApiRateLimiter returns service_unavailable when Redis enforcement fails', async () => {
  const redis = new InMemorySlidingWindowRedis()
  redis.failReads = true

  const limiter = new ApiRateLimiter({
    redisClient: redis,
    now: () => 1_000,
    createMemberId: () => 'req-1',
  })

  const decision = await limiter.consumeAnonymousGraphql('198.51.100.30')

  assert.deepEqual(decision, {
    ok: false,
    reason: 'service_unavailable',
  })
})
