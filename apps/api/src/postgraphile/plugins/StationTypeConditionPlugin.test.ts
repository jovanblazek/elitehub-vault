import assert from 'node:assert/strict'
import { sql } from 'postgraphile/@dataplan/pg'
import { test } from 'vitest'
import { StationType } from '@elitehub/db/schema'
import {
  applyStationTypeCondition,
  applyStationTypeInput,
} from './StationTypeConditionPlugin.js'

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

const compileCondition = (stationTypes: readonly StationType[]) => {
  const fragments: Array<ReturnType<typeof sql>> = []
  const condition = createCondition(fragments)

  applyStationTypeCondition(condition, stationTypes, sql.raw('stationTypeEnum'))

  assert.equal(fragments.length, 1)

  return sql.compile(fragments[0])
}

test('station type filters stations whose type matches any provided station type', () => {
  const compiled = compileCondition([StationType.Coriolis, StationType.Orbis])

  assert.equal(compiled.text, '"station"."stationType" = ANY($1::stationTypeEnum[])')
  assert.deepEqual(compiled.values, [[StationType.Coriolis, StationType.Orbis]])
})

test('station type input ignores nullish input', () => {
  const fragments: Array<ReturnType<typeof sql>> = []
  const condition = createCondition(fragments)

  applyStationTypeInput(condition, null, sql.raw('stationTypeEnum'))
  applyStationTypeInput(condition, undefined, sql.raw('stationTypeEnum'))

  assert.equal(fragments.length, 0)
})
