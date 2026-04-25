import assert from 'node:assert/strict'
import test from 'node:test'
import { LRUCache } from 'lru-cache'
import { ApiKeyResolver } from './apiKeyResolver.js'
import { hashApiKeySecret } from './apiKeyCrypto.js'

const buildApiKey = (publicId: string, secret: string) => `eh_live_${publicId}_${secret}`

test('ApiKeyResolver resolves a valid API key from the database and then local cache', async () => {
  const cache = new Map<string, string>()
  let lookupCount = 0

  const resolver = new ApiKeyResolver({
    localCache: new LRUCache({ max: 10, ttl: 60_000 }),
    getCacheValue: async (key) => cache.get(key) ?? null,
    setCacheValue: async (key, value) => {
      cache.set(key, value)
    },
    lookupApiKeyRecord: async (publicId) => {
      lookupCount += 1
      if (publicId !== 'pub1') {
        return null
      }

      return {
        apiKeyId: 'key-1',
        publicId: 'pub1',
        keyName: 'Key One',
        secretHash: hashApiKeySecret('secret-1'),
        rpmLimit: 90,
        maxSseConnections: 4,
        isActive: true,
      }
    },
  })

  const firstResult = await resolver.resolve(buildApiKey('pub1', 'secret-1'))
  const secondResult = await resolver.resolve(buildApiKey('pub1', 'secret-1'))

  assert.equal(firstResult.ok, true)
  assert.equal(secondResult.ok, true)
  assert.equal(lookupCount, 1)
  assert.equal(firstResult.ok && firstResult.consumer.type, 'apiKey')
  assert.equal(secondResult.ok && secondResult.consumer.type, 'apiKey')
})

test('ApiKeyResolver resolves from Redis cache before falling back to the database', async () => {
  let lookupCount = 0
  const resolver = new ApiKeyResolver({
    localCache: new LRUCache({ max: 10, ttl: 60_000 }),
    getCacheValue: async (key) => {
      if (key === 'api-key:meta:pub2') {
        return JSON.stringify({
          apiKeyId: 'key-2',
          publicId: 'pub2',
          keyName: 'Key Two',
          secretHash: hashApiKeySecret('secret-2'),
          rpmLimit: 75,
          maxSseConnections: 2,
          isActive: true,
        })
      }

      return null
    },
    lookupApiKeyRecord: async () => {
      lookupCount += 1
      return null
    },
  })

  const result = await resolver.resolve(buildApiKey('pub2', 'secret-2'))

  assert.equal(result.ok, true)
  assert.equal(lookupCount, 0)
  assert.equal(result.ok && result.consumer.type, 'apiKey')
})

test('ApiKeyResolver negative-caches unknown public IDs', async () => {
  const cache = new Map<string, string>()
  let lookupCount = 0

  const resolver = new ApiKeyResolver({
    localCache: new LRUCache({ max: 10, ttl: 60_000 }),
    getCacheValue: async (key) => cache.get(key) ?? null,
    setCacheValue: async (key, value) => {
      cache.set(key, value)
    },
    lookupApiKeyRecord: async () => {
      lookupCount += 1
      return null
    },
  })

  const firstResult = await resolver.resolve(buildApiKey('missing', 'secret-3'))
  const secondResult = await resolver.resolve(buildApiKey('missing', 'secret-3'))

  assert.deepEqual(firstResult, { ok: false, reason: 'invalid_api_key' })
  assert.deepEqual(secondResult, { ok: false, reason: 'invalid_api_key' })
  assert.equal(cache.get('api-key:missing:missing'), '1')
  assert.equal(lookupCount, 1)
})

test('ApiKeyResolver rejects malformed keys without touching the database', async () => {
  let lookupCount = 0
  const resolver = new ApiKeyResolver({
    lookupApiKeyRecord: async () => {
      lookupCount += 1
      return null
    },
  })

  const result = await resolver.resolve('not-a-valid-key')

  assert.deepEqual(result, { ok: false, reason: 'invalid_api_key' })
  assert.equal(lookupCount, 0)
})

test('ApiKeyResolver rejects mismatched secrets for a known public ID', async () => {
  const resolver = new ApiKeyResolver({
    localCache: new LRUCache({ max: 10, ttl: 60_000 }),
    getCacheValue: async () => null,
    setCacheValue: async () => {},
    lookupApiKeyRecord: async () => ({
      apiKeyId: 'key-4',
      publicId: 'pub4',
      keyName: 'Key Four',
      secretHash: hashApiKeySecret('real-secret'),
      rpmLimit: 60,
      maxSseConnections: 3,
      isActive: true,
    }),
  })

  const result = await resolver.resolve(buildApiKey('pub4', 'wrong-secret'))

  assert.deepEqual(result, { ok: false, reason: 'invalid_api_key' })
})
