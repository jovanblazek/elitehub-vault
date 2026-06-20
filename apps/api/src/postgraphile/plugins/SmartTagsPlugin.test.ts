import assert from 'node:assert/strict'
import { test } from 'vitest'
import { smartTagsConfig } from './SmartTagsPlugin.js'

test('stations.stationType is exposed to condition filtering', () => {
  assert.equal(
    smartTagsConfig.config.attribute['stations.stationType']?.tags?.behavior,
    '+filterBy'
  )
})
