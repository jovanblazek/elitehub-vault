import assert from 'node:assert/strict'
import { sql } from 'postgraphile/@dataplan/pg'
import { test } from 'vitest'
import {
  applyFactionStateArrayCondition,
  type FactionStateArrayFilterMode,
} from './FactionStateConditionsPlugin.js'

type MockCondition = {
  alias: ReturnType<typeof sql.identifier>
  where: (fragment: ReturnType<typeof sql>) => void
}

const compileCondition = (
  column: 'pendingStates' | 'activeStates' | 'recoveringStates',
  mode: FactionStateArrayFilterMode,
  states: readonly string[]
) => {
  const fragments: Array<ReturnType<typeof sql>> = []
  const condition: MockCondition = {
    alias: sql.identifier('faction_state'),
    where(fragment) {
      fragments.push(fragment)
    },
  }

  applyFactionStateArrayCondition(condition, column, mode, states)

  assert.equal(fragments.length, 1)

  return sql.compile(fragments[0])
}

test('applyFactionStateArrayCondition uses overlap semantics for any filters', () => {
  const compiled = compileCondition('activeStates', 'any', ['Boom', 'War'])

  assert.equal(compiled.text, '"faction_state"."activeStates" && $1')
  assert.deepEqual(compiled.values, [['Boom', 'War']])
})

test('applyFactionStateArrayCondition uses contains semantics for all filters', () => {
  const compiled = compileCondition('recoveringStates', 'all', ['Election', 'War'])

  assert.equal(compiled.text, '"faction_state"."recoveringStates" @> $1')
  assert.deepEqual(compiled.values, [['Election', 'War']])
})
