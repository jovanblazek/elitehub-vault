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

test('stations by distance plugin defers argument handling to field planning', async () => {
  const pluginSource = await readFile(path.resolve(currentDir, 'StationsByDistancePlugin.ts'), 'utf8')

  assert.doesNotMatch(pluginSource, /pgGetArgDetailsFromParameters/)
  assert.match(pluginSource, /args\.getRaw\('referenceSystemId'\)/)
})

test('smart tags hide the backing stations_by_distance procedure from direct GraphQL exposure', async () => {
  const smartTagsSource = await readFile(path.resolve(currentDir, 'SmartTagsPlugin.ts'), 'utf8')

  assert.match(smartTagsSource, /stations_by_distance/)
  assert.match(smartTagsSource, /behavior:\s*'-\*'/)
})

test('smart tags pin the station computed distance field name', async () => {
  const smartTagsSource = await readFile(path.resolve(currentDir, 'SmartTagsPlugin.ts'), 'utf8')

  assert.match(smartTagsSource, /station_distance/)
  assert.match(smartTagsSource, /fieldName:\s*'distance'/)
})
