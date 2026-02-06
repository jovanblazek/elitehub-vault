import test from 'node:test'
import assert from 'node:assert/strict'
import { getRealtimeChannelForEventType } from './eventChannels.js'
import { SYSTEM_POWERPLAY_UPDATED_CHANNEL } from './systemPowerplayUpdated.js'

test('returns channel for known realtime event', () => {
  const channel = getRealtimeChannelForEventType('systemPowerplayUpdated')
  assert.equal(channel, SYSTEM_POWERPLAY_UPDATED_CHANNEL)
})

test('returns null for unknown realtime event', () => {
  const channel = getRealtimeChannelForEventType('unknownEvent')
  assert.equal(channel, null)
})
