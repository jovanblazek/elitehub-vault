import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildFactionControlThreatChangedPublishTarget,
  buildFactionPresenceChangedPublishTarget,
  buildFactionStateChangedPublishTarget,
  buildSystemPowerplayUpdatedPowerScopedPayload,
  parseFactionControlThreatChangedOutboxPayload,
  parseFactionPresenceChangedOutboxPayload,
  parseFactionStateChangedOutboxPayload,
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

test('parseFactionPresenceChangedOutboxPayload validates required fields', () => {
  const parsed = parseFactionPresenceChangedOutboxPayload({
    factionId: 'faction-1',
    systemId: 'system-1',
    change: 'entered',
    source: 'db-trigger',
  })

  assert.deepEqual(parsed, {
    factionId: 'faction-1',
    systemId: 'system-1',
    change: 'entered',
  })
})

test('buildFactionPresenceChangedPublishTarget scopes payload to faction channel', () => {
  const target = buildFactionPresenceChangedPublishTarget({
    outboxPayload: {
      factionId: 'faction-1',
      systemId: 'system-1',
      change: 'left',
    },
    createdAt: new Date('2026-04-04T00:00:00.000Z'),
  })

  assert.deepEqual(target, {
    channel: 'events:factionPresenceChanged:faction:faction-1',
    payload: {
      event: 'factionPresenceChanged',
      factionId: 'faction-1',
      systemId: 'system-1',
      change: 'left',
      timestamp: '2026-04-04T00:00:00.000Z',
    },
  })
})

test('parseFactionStateChangedOutboxPayload validates conflict payloads', () => {
  const parsed = parseFactionStateChangedOutboxPayload({
    factionId: 'faction-1',
    systemId: 'system-1',
    stateKind: 'conflict',
    state: 'War',
    lifecycle: 'active',
    opponentFactionId: 'faction-2',
  })

  assert.deepEqual(parsed, {
    factionId: 'faction-1',
    systemId: 'system-1',
    stateKind: 'conflict',
    state: 'War',
    lifecycle: 'active',
    opponentFactionId: 'faction-2',
  })
})

test('buildFactionStateChangedPublishTarget scopes payload to faction channel', () => {
  const target = buildFactionStateChangedPublishTarget({
    outboxPayload: {
      factionId: 'faction-1',
      systemId: 'system-1',
      stateKind: 'state',
      state: 'Retreat',
      lifecycle: 'ended',
    },
    createdAt: new Date('2026-04-04T00:00:00.000Z'),
  })

  assert.deepEqual(target, {
    channel: 'events:factionStateChanged:faction:faction-1',
    payload: {
      event: 'factionStateChanged',
      factionId: 'faction-1',
      systemId: 'system-1',
      stateKind: 'state',
      state: 'Retreat',
      lifecycle: 'ended',
      timestamp: '2026-04-04T00:00:00.000Z',
    },
  })
})

test('parseFactionControlThreatChangedOutboxPayload validates required fields', () => {
  const parsed = parseFactionControlThreatChangedOutboxPayload({
    factionId: 'faction-1',
    systemId: 'system-1',
    status: 'entered',
    challengerFactionId: 'faction-2',
    gap: 0.08,
    threshold: 0.1,
  })

  assert.deepEqual(parsed, {
    factionId: 'faction-1',
    systemId: 'system-1',
    status: 'entered',
    challengerFactionId: 'faction-2',
    gap: 0.08,
    threshold: 0.1,
  })
})

test('buildFactionControlThreatChangedPublishTarget scopes payload to faction channel', () => {
  const target = buildFactionControlThreatChangedPublishTarget({
    outboxPayload: {
      factionId: 'faction-1',
      systemId: 'system-1',
      status: 'cleared',
      challengerFactionId: 'faction-2',
      gap: 0.11,
      threshold: 0.1,
    },
    createdAt: new Date('2026-04-04T00:00:00.000Z'),
  })

  assert.deepEqual(target, {
    channel: 'events:factionControlThreatChanged:faction:faction-1',
    payload: {
      event: 'factionControlThreatChanged',
      factionId: 'faction-1',
      systemId: 'system-1',
      status: 'cleared',
      challengerFactionId: 'faction-2',
      gap: 0.11,
      threshold: 0.1,
      timestamp: '2026-04-04T00:00:00.000Z',
    },
  })
})
