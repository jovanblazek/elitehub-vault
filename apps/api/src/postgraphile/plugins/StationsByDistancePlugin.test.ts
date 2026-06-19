import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'vitest'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

test('PostGraphile preset wires the stations by distance plugin', async () => {
  const pglSource = await readFile(path.resolve(currentDir, '../pgl.ts'), 'utf8')

  assert.match(pglSource, /StationsByDistancePlugin/)
  assert.match(pglSource, /SystemDistancePlugin/)
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
  assert.match(pluginSource, /as "__referenceSystemId"/)
  assert.match(pluginSource, /nearby_system\.position <-> \(\s*select reference_system\.position/)
  assert.match(pluginSource, /from public\.systems as reference_system\s+where reference_system\.id =/)
  assert.doesNotMatch(pluginSource, /from public\.systems as reference_system\s+join public\.systems as nearby_system/)
  assert.doesNotMatch(pluginSource, /setMeta\('__referenceSystemId'/)
  assert.match(pluginSource, /\.setOrderIsUnique\(/)
})

test('system distance plugin relaxes the argument and reuses source-carried metadata', async () => {
  const pluginSource = await readFile(path.resolve(currentDir, 'SystemDistancePlugin.ts'), 'utf8')

  assert.match(pluginSource, /changeNullability\(/)
  assert.match(pluginSource, /System:\s*\{\s*distance:\s*\{\s*args:\s*\{\s*referenceSystemId:\s*true/)
  assert.match(pluginSource, /wrapPlans\(/)
  assert.match(pluginSource, /Station:\s*\{\s*system\(/)
  assert.match(pluginSource, /System:\s*\{\s*distance\(/)
  assert.match(pluginSource, /WeakMap/)
  assert.match(pluginSource, /systemDistanceState\.set\(/)
  assert.match(pluginSource, /systemDistanceState\.get\(/)
  assert.match(pluginSource, /sql`\$\{\$source\.getClassStep\(\)\.alias\}\.\$\{sql\.identifier\(DISTANCE_META_KEY\)\}`/)
  assert.match(
    pluginSource,
    /sql`\$\{\$source\.getClassStep\(\)\.alias\}\.\$\{sql\.identifier\(REFERENCE_SYSTEM_ID_META_KEY\)\}`/
  )

  const distanceMetaIndex = pluginSource.indexOf('const $distance = cached?.distance')
  const explicitArgIndex = pluginSource.indexOf(
    "const explicitReferenceSystemId = fieldArgs.getRaw('referenceSystemId')"
  )

  assert.notStrictEqual(distanceMetaIndex, -1)
  assert.notStrictEqual(explicitArgIndex, -1)
  assert.ok(distanceMetaIndex < explicitArgIndex)
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
