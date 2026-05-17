import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'vitest'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

test('PostGraphile preset wires the stations by distance plugin', async () => {
  const pglSource = await readFile(path.resolve(currentDir, '../pgl.ts'), 'utf8')

  assert.match(pglSource, /StationsByDistancePlugin/)
})

test('stations by distance plugin queries the stations resource directly', async () => {
  const pluginSource = await readFile(path.resolve(currentDir, 'StationsByDistancePlugin.ts'), 'utf8')

  assert.match(pluginSource, /build\.pgResources\.stations\b/)
  assert.doesNotMatch(pluginSource, /stations_by_distance/)
  assert.match(pluginSource, /\.placeholder\(args\.getRaw\('referenceSystemId'\), TYPES\.uuid\)/)
})

test('stations by distance plugin applies distance ordering in extendSchema', async () => {
  const pluginSource = await readFile(path.resolve(currentDir, 'StationsByDistancePlugin.ts'), 'utf8')

  assert.match(pluginSource, /\.orderBy\(/)
  assert.match(pluginSource, /cube_distance/)
  assert.match(pluginSource, /\.setOrderIsUnique\(/)
})

test('smart tags expose distance from system_distance and not station_distance', async () => {
  const smartTagsSource = await readFile(path.resolve(currentDir, 'SmartTagsPlugin.ts'), 'utf8')

  assert.match(smartTagsSource, /system_distance/)
  assert.match(smartTagsSource, /fieldName:\s*'distance'/)
  assert.doesNotMatch(smartTagsSource, /station_distance/)
  assert.doesNotMatch(smartTagsSource, /stations_by_distance/)
})
