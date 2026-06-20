import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'vitest'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

test('PostGraphile preset wires the systems by distance plugin', async () => {
  const pglSource = await readFile(path.resolve(currentDir, '../pgl.ts'), 'utf8')

  assert.match(pglSource, /SystemsByDistancePlugin/)
})

test('systems by distance plugin builds a custom pgSelect over the systems resource', async () => {
  const pluginSource = await readFile(
    path.resolve(currentDir, 'SystemsByDistancePlugin.ts'),
    'utf8'
  )

  assert.match(pluginSource, /build\.pgResources\.systems\b/)
  assert.match(pluginSource, /pgSelect\(/)
  assert.match(pluginSource, /systems_by_distance/)
  assert.match(pluginSource, /const referenceSystemId = \$systems\.placeholder\(/)
  assert.doesNotMatch(pluginSource, /\$root\.placeholder\(/)
  assert.match(
    pluginSource,
    /\.placeholder\(\s*args\.getRaw\('referenceSystemId'\),\s*TYPES\.uuid\s*\)/
  )
  assert.doesNotMatch(pluginSource, /systemsResource\.find\(/)
})

test('systems by distance plugin applies distance ordering in extendSchema', async () => {
  const pluginSource = await readFile(
    path.resolve(currentDir, 'SystemsByDistancePlugin.ts'),
    'utf8'
  )

  assert.match(pluginSource, /\.where\(/)
  assert.match(pluginSource, /\.orderBy\(/)
  assert.match(pluginSource, /attribute:\s*'position'/)
  assert.match(pluginSource, /callback:\s*\(attributeExpression\)\s*=>\s*\[/)
  assert.match(pluginSource, /<->/)
  assert.match(pluginSource, /sql`\(\s*\$\{attributeExpression\}\s*<->/)
  assert.doesNotMatch(pluginSource, /__distance/)
  assert.doesNotMatch(pluginSource, /from:\s*\{\s*callback:\s*\(\$select\)\s*=>/)
  assert.match(pluginSource, /attributeExpression\} <-> \(\s*select reference_system\.position/)
  assert.match(
    pluginSource,
    /from public\.systems as reference_system\s+where reference_system\.id =/
  )
  assert.match(pluginSource, /\.setOrderIsUnique\(/)
})

test('smart tags expose distance from system_distance', async () => {
  const smartTagsSource = await readFile(path.resolve(currentDir, 'SmartTagsPlugin.ts'), 'utf8')

  assert.match(smartTagsSource, /system_distance/)
  assert.match(smartTagsSource, /fieldName:\s*'distance'/)
})
