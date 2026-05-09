import assert from 'node:assert/strict'
import { test } from 'vitest'
import { RedisSseConnectionLimiter } from './connectionLimiter.js'

type LeaseEntry = {
  member: string
  score: number
}

class InMemoryLeaseRedis {
  private readonly entriesByKey = new Map<string, LeaseEntry[]>()

  async eval(
    _script: string,
    _numKeys: number,
    key: string,
    ...args: Array<string | number>
  ): Promise<unknown> {
    if (args.length === 5) {
      const [now, expiresAt, maxConnections, connectionLeaseId] = args as [
        number,
        number,
        number,
        string,
        number,
      ]
      const existing = this.getActiveEntries(key, now)

      if (existing.length >= maxConnections) {
        return [0, existing.length, maxConnections]
      }

      existing.push({ member: connectionLeaseId, score: expiresAt })
      this.entriesByKey.set(key, existing)
      return [1, existing.length, maxConnections]
    }

    if (args.length === 4) {
      const [now, expiresAt, connectionLeaseId] = args as [number, number, string, number]
      const existing = this.getActiveEntries(key, now)
      const lease = existing.find((entry) => entry.member === connectionLeaseId)
      if (!lease) {
        this.entriesByKey.set(key, existing)
        return 0
      }

      lease.score = expiresAt
      this.entriesByKey.set(key, existing)
      return 1
    }

    if (args.length === 1) {
      const [connectionLeaseId] = args as [string]
      const existing = (this.entriesByKey.get(key) ?? []).filter((entry) => entry.member !== connectionLeaseId)
      if (existing.length === 0) {
        this.entriesByKey.delete(key)
      } else {
        this.entriesByKey.set(key, existing)
      }
      return 1
    }

    throw new Error(`Unsupported eval invocation with ${args.length} args`)
  }

  async keys(pattern: string): Promise<string[]> {
    if (pattern !== 'sse:leases:*') {
      return []
    }

    return Array.from(this.entriesByKey.keys()).filter((key) => key.startsWith('sse:leases:'))
  }

  async del(...keys: string[]) {
    for (const key of keys) {
      this.entriesByKey.delete(key)
    }
  }

  seedLease(key: string, member: string, score: number) {
    const existing = this.entriesByKey.get(key) ?? []
    existing.push({ member, score })
    this.entriesByKey.set(key, existing)
  }

  hasKey(key: string) {
    return this.entriesByKey.has(key)
  }

  private getActiveEntries(key: string, now: number) {
    return (this.entriesByKey.get(key) ?? []).filter((entry) => entry.score > now)
  }
}

test('RedisSseConnectionLimiter.refreshLease does not revive an expired lease', async () => {
  const redis = new InMemoryLeaseRedis()
  const limiter = new RedisSseConnectionLimiter({
    redisClient: redis,
    now: () => 1_000,
  })

  redis.seedLease('sse:leases:key-1', 'lease-1', 900)

  const refreshed = await limiter.refreshLease('key-1', 'lease-1')

  assert.equal(refreshed, false)
  assert.equal(redis.hasKey('sse:leases:key-1'), true)
})

test('RedisSseConnectionLimiter.clearAllLeases removes startup-stale SSE leases', async () => {
  const redis = new InMemoryLeaseRedis()
  const limiter = new RedisSseConnectionLimiter({
    redisClient: redis,
    now: () => 1_000,
  })

  redis.seedLease('sse:leases:key-1', 'lease-1', 5_000)
  redis.seedLease('sse:leases:key-2', 'lease-2', 5_000)
  redis.seedLease('other:key-1', 'value', 5_000)

  await limiter.clearAllLeases()

  assert.equal(redis.hasKey('sse:leases:key-1'), false)
  assert.equal(redis.hasKey('sse:leases:key-2'), false)
  assert.equal(redis.hasKey('other:key-1'), true)
})
