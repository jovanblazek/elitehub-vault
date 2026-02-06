import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildSystemPowerplayUpdatedPowerScopedPayload,
  parseSystemPowerplayUpdatedOutboxPayload,
} from './eventPayloads.js'

test('parseSystemPowerplayUpdatedOutboxPayload validates required fields', () => {
  const parsed = parseSystemPowerplayUpdatedOutboxPayload({
    systemId: 'system-1',
    changedFields: ['powerplayState', 'powerplayStateUndermining'],
    source: 'eddn-worker',
    metadata: { foo: 'bar' },
  })

  assert.deepEqual(parsed, {
    systemId: 'system-1',
    changedFields: ['powerplayState', 'powerplayStateUndermining'],
    source: 'eddn-worker',
    metadata: { foo: 'bar' },
  })
})

test('buildSystemPowerplayUpdatedPowerScopedPayload adds powerId and timestamp from createdAt', () => {
  const payload = buildSystemPowerplayUpdatedPowerScopedPayload({
    outboxPayload: {
      systemId: 'system-1',
      changedFields: ['powerplayStateControlProgress'],
    },
    createdAt: new Date('2026-02-07T00:00:00.000Z'),
    powerId: 'power-123',
  })

  assert.deepEqual(payload, {
    event: 'systemPowerplayUpdated',
    systemId: 'system-1',
    powerId: 'power-123',
    changedFields: ['powerplayStateControlProgress'],
    timestamp: '2026-02-07T00:00:00.000Z',
    source: 'eddn-worker',
    metadata: {},
  })
})

test('buildSystemPowerplayUpdatedPowerScopedPayload returns null for invalid outbox payload', () => {
  const payload = buildSystemPowerplayUpdatedPowerScopedPayload({
    outboxPayload: {
      changedFields: ['powerplayState'],
    },
    createdAt: new Date('2026-02-07T00:00:00.000Z'),
    powerId: 'power-123',
  })

  assert.equal(payload, null)
})
