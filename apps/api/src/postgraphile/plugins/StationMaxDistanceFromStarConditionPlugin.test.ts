import assert from 'node:assert/strict'
import { sql } from 'postgraphile/@dataplan/pg'
import { test } from 'vitest'
import { applyMaxDistanceFromStarInput } from './StationMaxDistanceFromStarConditionPlugin.js'

test('max distance from star filters stations within the inclusive threshold', () => {
  const fragments: Array<ReturnType<typeof sql>> = []

  applyMaxDistanceFromStarInput(
    {
      alias: sql.identifier('station'),
      where(fragment) {
        fragments.push(fragment)
      },
    },
    1250.5
  )

  assert.equal(fragments.length, 1)

  const compiled = sql.compile(fragments[0])
  assert.equal(compiled.text, '"station"."distanceFromStar" <= $1')
  assert.deepEqual(compiled.values, [1250.5])
})

test('max distance from star ignores nullish input', () => {
  const fragments: Array<ReturnType<typeof sql>> = []

  applyMaxDistanceFromStarInput(
    {
      alias: sql.identifier('station'),
      where(fragment) {
        fragments.push(fragment)
      },
    },
    null
  )

  applyMaxDistanceFromStarInput(
    {
      alias: sql.identifier('station'),
      where(fragment) {
        fragments.push(fragment)
      },
    },
    undefined
  )

  assert.equal(fragments.length, 0)
})
