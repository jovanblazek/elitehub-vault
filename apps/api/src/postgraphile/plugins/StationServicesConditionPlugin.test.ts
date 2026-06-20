import assert from 'node:assert/strict'
import { sql } from 'postgraphile/@dataplan/pg'
import { test } from 'vitest'
import {
  applyStationServicesCondition,
  applyStationServicesInput,
} from './StationServicesConditionPlugin.js'

type MockCondition = {
  alias: ReturnType<typeof sql.identifier>
  where: (fragment: ReturnType<typeof sql>) => void
}

const createCondition = (fragments: Array<ReturnType<typeof sql>>): MockCondition => ({
  alias: sql.identifier('station'),
  where(fragment) {
    fragments.push(fragment)
  },
})

const compileCondition = (services: readonly string[]) => {
  const fragments: Array<ReturnType<typeof sql>> = []
  const condition = createCondition(fragments)

  applyStationServicesCondition(condition, services)

  assert.equal(fragments.length, 1)

  return sql.compile(fragments[0])
}

test('station services uses contains semantics for AND filtering', () => {
  const compiled = compileCondition(['dock', 'repair'])

  assert.equal(compiled.text, '"station"."servicesV2" @> $1')
  assert.deepEqual(compiled.values, [['dock', 'repair']])
})

test('station services input ignores nullish input', () => {
  const fragments: Array<ReturnType<typeof sql>> = []
  const condition = createCondition(fragments)

  applyStationServicesInput(condition, null)
  applyStationServicesInput(condition, undefined)

  assert.equal(fragments.length, 0)
})
