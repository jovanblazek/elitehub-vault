import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSystemPowerplayPublishTargets } from '@elitehub/queue-contracts'

test('buildSystemPowerplayPublishTargets returns one publish target per powerId', () => {
  const targets = buildSystemPowerplayPublishTargets({
    outboxPayload: {
      systemId: 'system-1',
      changedFields: ['powerplayState', 'powerplayStateUndermining'],
    },
    createdAt: new Date('2026-02-07T00:00:00.000Z'),
    powerIds: ['power-a', 'power-b'],
  })

  assert.equal(targets.length, 2)
  assert.equal(targets[0]?.channel, 'events:systemPowerplayUpdated:power:power-a')
  assert.equal(targets[1]?.channel, 'events:systemPowerplayUpdated:power:power-b')
  assert.equal(targets[0]?.payload.powerId, 'power-a')
  assert.equal(targets[1]?.payload.powerId, 'power-b')
})

test('buildSystemPowerplayPublishTargets returns empty list when payload is invalid', () => {
  const targets = buildSystemPowerplayPublishTargets({
    outboxPayload: {
      changedFields: ['powerplayState'],
    },
    createdAt: new Date('2026-02-07T00:00:00.000Z'),
    powerIds: ['power-a'],
  })

  assert.deepEqual(targets, [])
})

test('buildSystemPowerplayPublishTargets returns empty list when there are no powers', () => {
  const targets = buildSystemPowerplayPublishTargets({
    outboxPayload: {
      systemId: 'system-1',
      changedFields: ['powerplayState'],
    },
    createdAt: new Date('2026-02-07T00:00:00.000Z'),
    powerIds: [],
  })

  assert.deepEqual(targets, [])
})
