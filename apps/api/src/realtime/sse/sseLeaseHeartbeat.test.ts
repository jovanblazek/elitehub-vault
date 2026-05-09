import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import type { ServerResponse } from 'node:http'
import { test } from 'vitest'
import { RedisSseConnectionLimiter } from './connectionLimiter.js'
import { refreshSseLeaseOrClose } from './sseLeaseHeartbeat.js'

class FakeResponse extends EventEmitter {
  public writableEnded = false

  end() {
    this.writableEnded = true
    this.emit('close')
  }
}

test('RedisSseConnectionLimiter.refreshLease returns false when the lease is missing', async () => {
  const limiter = new RedisSseConnectionLimiter({
    redisClient: {
      eval: async () => 0,
    },
  })
  const refreshed = await limiter.refreshLease('key-1', 'lease-1')

  assert.equal(refreshed, false)
})

test('refreshSseLeaseOrClose closes the SSE response when the lease can no longer be refreshed', async () => {
  const response = new FakeResponse()
  let released = 0

  await refreshSseLeaseOrClose({
    apiKeyId: 'key-1',
    connectionLeaseId: 'lease-1',
    response: response as unknown as ServerResponse,
    releaseQuota: () => {
      released += 1
    },
    connectionLimiter: {
      refreshLease: async () => false,
    },
  })

  assert.equal(released, 1)
  assert.equal(response.writableEnded, true)
})
