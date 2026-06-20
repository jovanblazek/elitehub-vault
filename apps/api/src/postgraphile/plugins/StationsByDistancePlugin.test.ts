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

test('stations by distance plugin builds a custom pgSelect over the stations resource', async () => {
  const pluginSource = await readFile(path.resolve(currentDir, 'StationsByDistancePlugin.ts'), 'utf8')

  assert.match(pluginSource, /build\.pgResources\.stations\b/)
  assert.match(pluginSource, /pgSelect\(/)
  assert.match(pluginSource, /stations_by_distance/)
  assert.match(pluginSource, /\.placeholder\(\s*args\.getRaw\('referenceSystemId'\),\s*TYPES\.uuid\s*\)/)
  assert.doesNotMatch(pluginSource, /stationsResource\.find\(/)
})

test('stations by distance plugin applies system-first distance ordering in extendSchema', async () => {
  const pluginSource = await readFile(path.resolve(currentDir, 'StationsByDistancePlugin.ts'), 'utf8')

  assert.match(pluginSource, /\.orderBy\(/)
  assert.match(pluginSource, /<->/)
  assert.match(pluginSource, /__distance/)
  assert.match(pluginSource, /from:\s*\{\s*callback:\s*\(\$select\)\s*=>/)
  assert.match(pluginSource, /from public\.systems as nearby_system/)
  assert.match(pluginSource, /join public\.stations as station/)
  assert.match(pluginSource, /nearby_system\.position <-> \(\s*select reference_system\.position/)
  assert.match(pluginSource, /from public\.systems as reference_system\s+where reference_system\.id =/)
  assert.doesNotMatch(pluginSource, /from public\.systems as reference_system\s+join public\.systems as nearby_system/)
  assert.doesNotMatch(pluginSource, /attribute:\s*'id'/)
  assert.doesNotMatch(pluginSource, /\.setOrderIsUnique\(/)
})

test('smart tags expose distance from system_distance and not station_distance', async () => {
  const smartTagsSource = await readFile(path.resolve(currentDir, 'SmartTagsPlugin.ts'), 'utf8')

  assert.match(smartTagsSource, /system_distance/)
  assert.match(smartTagsSource, /fieldName:\s*'distance'/)
  assert.doesNotMatch(smartTagsSource, /station_distance/)
  assert.doesNotMatch(smartTagsSource, /stations_by_distance/)
})

test('systems schema declares a GiST index for position', async () => {
  const schemaSource = await readFile(
    path.resolve(currentDir, '../../../../../packages/db/src/schema.ts'),
    'utf8'
  )

  assert.match(schemaSource, /\.using\('gist',\s*table\.position\)/)
})
