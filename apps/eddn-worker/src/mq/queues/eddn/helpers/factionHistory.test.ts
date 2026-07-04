import assert from 'node:assert/strict'
import { test } from 'vitest'
import { FactionHappiness, FactionState } from '@elitehub/db/schema'
import {
  buildFactionStateHistoryRows,
  type FactionStateHistoryRow,
  type FactionStateInsertRow,
} from './factionHistory.js'

const baseIncomingRow: FactionStateInsertRow = {
  factionId: 'faction-1',
  systemId: 'system-1',
  happiness: FactionHappiness.Happy,
  influence: 0.42,
  activeStates: [FactionState.Boom],
  recoveringStates: [],
  pendingStates: [FactionState.Expansion],
  activeStatesRaw: [{ State: 'Boom' }],
  recoveringStatesRaw: [],
  pendingStatesRaw: [{ State: 'Expansion', Trend: 0 }],
}

const baseExistingRow: FactionStateHistoryRow = {
  id: 'history-1',
  factionId: baseIncomingRow.factionId,
  systemId: baseIncomingRow.systemId,
  isPresent: true,
  happiness: baseIncomingRow.happiness ?? null,
  influence: baseIncomingRow.influence,
  activeStates: baseIncomingRow.activeStates ?? [],
  recoveringStates: baseIncomingRow.recoveringStates ?? [],
  pendingStates: baseIncomingRow.pendingStates ?? [],
  activeStatesRaw: baseIncomingRow.activeStatesRaw ?? [],
  recoveringStatesRaw: baseIncomingRow.recoveringStatesRaw ?? [],
  pendingStatesRaw: baseIncomingRow.pendingStatesRaw ?? [],
  createdAt: new Date('2026-07-04T00:00:00.000Z'),
}

test('buildFactionStateHistoryRows emits a present history row when faction state changes', () => {
  const rows = buildFactionStateHistoryRows({
    existingRows: [baseExistingRow],
    incomingRows: [{ ...baseIncomingRow, influence: 0.51 }],
  })

  assert.deepEqual(rows, [{ ...baseIncomingRow, influence: 0.51, isPresent: true }])
})

test('buildFactionStateHistoryRows does not emit history when faction state is unchanged', () => {
  const rows = buildFactionStateHistoryRows({
    existingRows: [baseExistingRow],
    incomingRows: [baseIncomingRow],
  })

  assert.deepEqual(rows, [])
})

test('buildFactionStateHistoryRows emits a terminal absent row for factions removed from the system', () => {
  const rows = buildFactionStateHistoryRows({
    existingRows: [baseExistingRow],
    incomingRows: [],
  })

  assert.deepEqual(rows, [{ ...baseExistingRow, isPresent: false }])
})
