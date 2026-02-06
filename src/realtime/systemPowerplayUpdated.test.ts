import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildSystemPowerplayUpdatedPayload,
  filterSystemPowerplayChangedFields,
  SYSTEM_POWERPLAY_UPDATED_EVENT,
} from './systemPowerplayUpdated.js'

test('filterSystemPowerplayChangedFields keeps only tracked fields', () => {
  const changedFields = filterSystemPowerplayChangedFields([
    'powerplayState',
    'population',
    'powerplayStateUndermining',
  ])

  assert.deepEqual(changedFields, ['powerplayState', 'powerplayStateUndermining'])
})

test('buildSystemPowerplayUpdatedPayload maps required event contract', () => {
  const timestamp = '2026-02-06T21:45:00.000Z'
  const payload = buildSystemPowerplayUpdatedPayload({
    systemId: 'system-123',
    changedFields: ['powerplayStateControlProgress', 'notTracked'],
    createdAt: timestamp,
    metadata: { ingestor: 'eddn' },
  })

  assert.equal(payload.event, SYSTEM_POWERPLAY_UPDATED_EVENT)
  assert.equal(payload.systemId, 'system-123')
  assert.deepEqual(payload.changedFields, ['powerplayStateControlProgress'])
  assert.equal(payload.timestamp, timestamp)
  assert.equal(payload.source, 'eddn-worker')
  assert.deepEqual(payload.metadata, { ingestor: 'eddn' })
})

test('buildSystemPowerplayUpdatedPayload defaults metadata and serializes Date timestamps', () => {
  const createdAt = new Date('2026-02-06T21:45:00.000Z')
  const payload = buildSystemPowerplayUpdatedPayload({
    systemId: 'system-456',
    changedFields: ['powerplayStateReinforcement', 'powerplayStateUndermining'],
    createdAt,
  })

  assert.equal(payload.timestamp, '2026-02-06T21:45:00.000Z')
  assert.deepEqual(payload.metadata, {})
})
