import assert from 'node:assert/strict'
import { sql } from 'postgraphile/@dataplan/pg'
import { test } from 'vitest'
import {
  applyMinLandingPadSizeCondition,
  getLandingPadColumnsForMinSize,
  type LandingPadSize,
} from './StationMinLandingPadSizeConditionPlugin.js'

const expectColumns = (
  size: LandingPadSize,
  expected: Array<'landingPadsSmall' | 'landingPadsMedium' | 'landingPadsLarge'>
) => {
  assert.deepEqual(getLandingPadColumnsForMinSize(size), expected)
}

const compileCondition = (size: LandingPadSize) => {
  const fragments: Array<ReturnType<typeof sql>> = []

  applyMinLandingPadSizeCondition(
    {
      alias: sql.identifier('station'),
      where(fragment) {
        fragments.push(fragment)
      },
    },
    size
  )

  assert.equal(fragments.length, 1)

  return sql.compile(fragments[0])
}

test('small min landing pad size matches all station pad columns', () => {
  expectColumns('SMALL', ['landingPadsSmall', 'landingPadsMedium', 'landingPadsLarge'])
})

test('medium min landing pad size matches medium and large station pad columns', () => {
  expectColumns('MEDIUM', ['landingPadsMedium', 'landingPadsLarge'])
})

test('large min landing pad size matches only large station pad columns', () => {
  expectColumns('LARGE', ['landingPadsLarge'])
})

test('medium min landing pad size filters for medium or large pads', () => {
  const compiled = compileCondition('MEDIUM')

  assert.equal(
    compiled.text,
    '("station"."landingPadsMedium" > 0 or "station"."landingPadsLarge" > 0)'
  )
  assert.deepEqual(compiled.values, [])
})

test('large min landing pad size filters only for large pads', () => {
  const compiled = compileCondition('LARGE')

  assert.equal(compiled.text, '("station"."landingPadsLarge" > 0)')
  assert.deepEqual(compiled.values, [])
})
