import assert from 'node:assert/strict'
import { test } from 'vitest'
import { buildPublishTargetsForOutboxRow } from './eventPublishTargets.js'

test('buildPublishTargetsForOutboxRow builds faction publish targets', () => {
  const targets = buildPublishTargetsForOutboxRow({
    eventType: 'factionPresenceChanged',
    outboxPayload: {
      factionId: 'faction-1',
      systemId: 'system-1',
      change: 'entered',
    },
    createdAt: new Date('2026-04-04T00:00:00.000Z'),
  })

  assert.deepEqual(targets, [
    {
      channel: 'events:factionPresenceChanged:faction:faction-1',
      payload: {
        event: 'factionPresenceChanged',
        factionId: 'faction-1',
        systemId: 'system-1',
        change: 'entered',
        timestamp: '2026-04-04T00:00:00.000Z',
      },
    },
  ])
})

test('buildPublishTargetsForOutboxRow returns null for unknown event types', () => {
  const targets = buildPublishTargetsForOutboxRow({
    eventType: 'unknown',
    outboxPayload: {},
    createdAt: new Date('2026-04-04T00:00:00.000Z'),
  })

  assert.equal(targets, null)
})
