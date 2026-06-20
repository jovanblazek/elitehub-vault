import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'vitest'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

test('PostGraphile preset wires the faction states by distance plugin', async () => {
  const pglSource = await readFile(path.resolve(currentDir, '../pgl.ts'), 'utf8')

  assert.match(pglSource, /FactionStatesByDistancePlugin/)
})

test('faction states by distance plugin builds a custom pgSelect over the factionStates resource', async () => {
  const pluginSource = await readFile(
    path.resolve(currentDir, 'FactionStatesByDistancePlugin.ts'),
    'utf8'
  )

  assert.match(pluginSource, /build\.pgResources\.factionStates\b/)
  assert.match(pluginSource, /pgSelect\(/)
  assert.match(pluginSource, /faction_states_by_distance/)
  assert.match(
    pluginSource,
    /\.placeholder\(\s*args\.getRaw\('referenceSystemId'\),\s*TYPES\.uuid\s*\)/
  )
  assert.doesNotMatch(pluginSource, /factionStatesResource\.find\(/)
})

test('faction states by distance plugin applies system-first distance ordering in extendSchema', async () => {
  const pluginSource = await readFile(
    path.resolve(currentDir, 'FactionStatesByDistancePlugin.ts'),
    'utf8'
  )

  assert.match(pluginSource, /\.orderBy\(/)
  assert.match(pluginSource, /<->/)
  assert.match(pluginSource, /__distance/)
  assert.match(pluginSource, /from:\s*\{\s*callback:\s*\(\$select\)\s*=>/)
  assert.match(pluginSource, /from public\.systems as nearby_system/)
  assert.match(pluginSource, /join lateral \(\s*select fs\.\*/)
  assert.match(pluginSource, /from public\."factionStates" as fs/)
  assert.match(pluginSource, /where fs\."systemId" = nearby_system\.id/)
  assert.match(pluginSource, /nearby_system\.position <-> \(\s*select reference_system\.position/)
  assert.match(pluginSource, /from public\.systems as reference_system\s+where reference_system\.id =/)
  assert.doesNotMatch(pluginSource, /from public\.systems as reference_system\s+join public\.systems as nearby_system/)
  assert.doesNotMatch(pluginSource, /attribute:\s*'id'/)
  assert.doesNotMatch(pluginSource, /\.setOrderIsUnique\(/)
})

test('faction states schema declares a systemId index to support system-first distance joins', async () => {
  const schemaSource = await readFile(
    path.resolve(currentDir, '../../../../../packages/db/src/schema.ts'),
    'utf8'
  )

  assert.match(schemaSource, /index\(\)\.on\(table\.systemId\)/)
})
