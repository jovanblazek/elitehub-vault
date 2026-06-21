import assert from 'node:assert/strict'
import { sql } from 'postgraphile/@dataplan/pg'
import { test } from 'vitest'
import {
  applyMaxPopulationInput,
  applyMinPopulationInput,
} from './SystemPopulationConditionPlugin.js'

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

test('min population filters systems at or above the inclusive threshold', () => {
  const fragments: Array<ReturnType<typeof sql>> = []

  applyMinPopulationInput(createCondition(fragments), 5000000)

  assert.equal(fragments.length, 1)

  const compiled = sql.compile(fragments[0])
  assert.equal(compiled.text, '"system"."population" >= $1')
  assert.deepEqual(compiled.values, [5000000])
})

test('max population filters systems at or below the inclusive threshold', () => {
  const fragments: Array<ReturnType<typeof sql>> = []

  applyMaxPopulationInput(createCondition(fragments), 9000000)

  assert.equal(fragments.length, 1)

  const compiled = sql.compile(fragments[0])
  assert.equal(compiled.text, '"system"."population" <= $1')
  assert.deepEqual(compiled.values, [9000000])
})

test('system population inputs ignore nullish input', () => {
  const fragments: Array<ReturnType<typeof sql>> = []
  const condition = createCondition(fragments)

  applyMinPopulationInput(condition, null)
  applyMinPopulationInput(condition, undefined)
  applyMaxPopulationInput(condition, null)
  applyMaxPopulationInput(condition, undefined)

  assert.equal(fragments.length, 0)
})
