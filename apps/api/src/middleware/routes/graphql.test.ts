import assert from 'node:assert/strict'
import { afterEach, test, vi } from 'vitest'
import { apiKeyResolver } from '../../auth/apiKeyResolver.js'
import { apiRateLimiter } from '../../auth/apiRateLimiter.js'
import { graphqlRoute } from './graphql.js'
import { requireApiKey } from '../auth/requireApiKey.js'

type TestContext = {
  path: string
  method: string
  ip: string
  headers: Record<string, string>
  state: Record<string, unknown>
  status?: number
  body?: unknown
  responseHeaders: Map<string, string>
  set: (name: string, value: string) => void
}

const createContext = (overrides: Partial<TestContext> = {}): TestContext => ({
  path: '/graphql',
  method: 'GET',
  ip: '127.0.0.1',
  headers: {},
  state: {},
  responseHeaders: new Map<string, string>(),
  set(name: string, value: string) {
    this.responseHeaders.set(name, value)
  },
  ...overrides,
})

afterEach(() => {
  vi.restoreAllMocks()
})

test('graphqlRoute rate-limits anonymous GET requests by IP and forwards on success', async () => {
  let nextCalls = 0

  vi.spyOn(apiRateLimiter, 'consumeAnonymousGraphql').mockImplementation(
    async (ipAddress: string) => {
      assert.equal(ipAddress, '198.51.100.40')
      return {
        ok: true,
        headers: {
          limit: 30,
          remaining: 29,
          reset: 123,
        },
      }
    }
  )

  const ctx = createContext({
    ip: '198.51.100.40',
  })

  await graphqlRoute(ctx as never, async () => {
    nextCalls += 1
  })

  assert.equal(nextCalls, 1)
  assert.equal(ctx.responseHeaders.get('X-RateLimit-Limit'), '30')
  assert.equal(ctx.responseHeaders.get('X-RateLimit-Remaining'), '29')
  assert.equal(ctx.responseHeaders.get('X-RateLimit-Reset'), '123')
  assert.equal(ctx.responseHeaders.get('Retry-After'), undefined)
})

test('graphqlRoute resolves API keys and applies the authenticated rpm limit on POST', async () => {
  let nextCalls = 0
  const consumer = {
    type: 'apiKey' as const,
    apiKeyId: 'key-123',
    publicId: 'pub',
    keyName: 'Key',
    rpmLimit: 77,
    maxSseConnections: 2,
  }

  vi.spyOn(apiKeyResolver, 'resolve').mockImplementation(async (rawApiKey: string | undefined) => {
    assert.equal(rawApiKey, 'eh_live_pub_secret')
    return {
      ok: true,
      consumer,
    }
  })

  vi.spyOn(apiRateLimiter, 'consumeAuthenticatedGraphql').mockImplementation(
    async (apiKeyId: string, limit: number) => {
      assert.equal(apiKeyId, 'key-123')
      assert.equal(limit, 77)
      return {
        ok: true,
        headers: {
          limit,
          remaining: 76,
          reset: 555,
        },
      }
    }
  )

  const ctx = createContext({
    method: 'POST',
    headers: {
      'x-api-key': 'eh_live_pub_secret',
    },
  })

  await graphqlRoute(ctx as never, async () => {
    nextCalls += 1
  })

  assert.equal(nextCalls, 1)
  assert.equal(ctx.state.apiConsumer, consumer)
  assert.equal(ctx.responseHeaders.get('X-RateLimit-Limit'), '77')
})

test('requireApiKey rate-limits repeated invalid API key attempts and returns 401 when under limit', async () => {
  vi.spyOn(apiKeyResolver, 'resolve').mockImplementation(async () => ({
    ok: false,
    reason: 'invalid_api_key',
  }))

  vi.spyOn(apiRateLimiter, 'consumeInvalidApiKeyAttempt').mockImplementation(
    async (ipAddress: string) => {
      assert.equal(ipAddress, '203.0.113.55')
      return {
        ok: true,
        headers: {
          limit: 20,
          remaining: 19,
          reset: 800,
        },
      }
    }
  )

  const ctx = createContext({
    ip: '203.0.113.55',
    headers: {
      'x-api-key': 'bad-key',
    },
  })

  const result = await requireApiKey(ctx as never)

  assert.equal(result, null)
  assert.equal(ctx.status, 401)
  assert.deepEqual(ctx.body, {
    error: 'Unauthorized',
    message: 'Invalid or inactive API key',
  })
  assert.equal(ctx.responseHeaders.get('X-RateLimit-Limit'), '20')
  assert.equal(ctx.responseHeaders.get('X-RateLimit-Remaining'), '19')
})
