import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'vitest'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

test('PostGraphile preset wires the factions by distance plugin', async () => {
  const pglSource = await readFile(path.resolve(currentDir, '../pgl.ts'), 'utf8')

  assert.match(pglSource, /FactionsByDistancePlugin/)
})

test('factions by distance plugin builds a custom pgSelect over the factions resource', async () => {
  const pluginSource = await readFile(path.resolve(currentDir, 'FactionsByDistancePlugin.ts'), 'utf8')

  assert.match(pluginSource, /build\.pgResources\.factions\b/)
  assert.match(pluginSource, /pgSelect\(/)
  assert.match(pluginSource, /factions_by_distance/)
  assert.match(pluginSource, /\.placeholder\(\s*args\.getRaw\('referenceSystemId'\),\s*TYPES\.uuid\s*\)/)
  assert.doesNotMatch(pluginSource, /factionsResource\.find\(/)
})

test('factions by distance plugin applies system-first nearest-faction ordering in extendSchema', async () => {
  const pluginSource = await readFile(path.resolve(currentDir, 'FactionsByDistancePlugin.ts'), 'utf8')

  assert.match(pluginSource, /\.orderBy\(/)
  assert.match(pluginSource, /<->/)
  assert.match(pluginSource, /__distance/)
  assert.match(pluginSource, /with ranked_systems as materialized/)
  assert.match(pluginSource, /distinct on \(faction\.id\)/)
  assert.match(pluginSource, /from public\.systems as nearby_system/)
  assert.match(pluginSource, /const rankedSystemLimit = sql\.literal\(String\(RANKED_SYSTEM_LIMIT\)\)/)
  assert.match(pluginSource, /limit \$\{rankedSystemLimit\}/)
  assert.match(pluginSource, /from ranked_systems/)
  assert.match(pluginSource, /join public\."systemFactions" as system_faction/)
  assert.match(pluginSource, /join public\.factions as faction/)
  assert.match(pluginSource, /nearby_system\.position <-> \(\s*select reference_system\.position/)
  assert.match(pluginSource, /order by faction\.id, ranked_systems\.__distance, ranked_systems\.id/)
  assert.doesNotMatch(pluginSource, /factionsResource\.find\(/)
  assert.doesNotMatch(pluginSource, /attribute:\s*'id'/)
  assert.doesNotMatch(pluginSource, /\.setOrderIsUnique\(/)
})

test('systems schema declares a GiST index for position for faction distance queries', async () => {
  const schemaSource = await readFile(
    path.resolve(currentDir, '../../../../../packages/db/src/schema.ts'),
    'utf8'
  )

  assert.match(schemaSource, /\.using\('gist',\s*table\.position\)/)
})
