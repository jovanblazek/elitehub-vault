import assert from 'node:assert/strict'
import { sql } from 'postgraphile/@dataplan/pg'
import { test } from 'vitest'
import { PowerplayState } from '@elitehub/db/schema'
import {
  applySystemPowerplayStateCondition,
  applySystemPowerplayStateInput,
} from './SystemPowerplayStateConditionPlugin.js'

type MockCondition = {
  alias: ReturnType<typeof sql.identifier>
  where: (fragment: ReturnType<typeof sql>) => void
}

const createCondition = (fragments: Array<ReturnType<typeof sql>>): MockCondition => ({
  alias: sql.identifier('system'),
  where(fragment) {
    fragments.push(fragment)
  },
})

const compileCondition = (powerplayStates: readonly PowerplayState[]) => {
  const fragments: Array<ReturnType<typeof sql>> = []
  const condition = createCondition(fragments)

  applySystemPowerplayStateCondition(condition, powerplayStates, sql.raw('powerplayStateEnum'))

  assert.equal(fragments.length, 1)

  return sql.compile(fragments[0])
}

test('system powerplay state filters systems whose state matches any provided state', () => {
  const compiled = compileCondition([PowerplayState.Stronghold, PowerplayState.Fortified])

  assert.equal(compiled.text, '"system"."powerplayState" = ANY($1::powerplayStateEnum[])')
  assert.deepEqual(compiled.values, [[PowerplayState.Stronghold, PowerplayState.Fortified]])
})

test('system powerplay state input ignores nullish input', () => {
  const fragments: Array<ReturnType<typeof sql>> = []
  const condition = createCondition(fragments)

  applySystemPowerplayStateInput(condition, null, sql.raw('powerplayStateEnum'))
  applySystemPowerplayStateInput(condition, undefined, sql.raw('powerplayStateEnum'))

  assert.equal(fragments.length, 0)
})
