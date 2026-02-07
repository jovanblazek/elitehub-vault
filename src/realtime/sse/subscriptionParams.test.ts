import assert from 'node:assert/strict'
import test from 'node:test'
import { parseSseSubscriptionQuery } from './subscriptionParams.js'

test('parseSseSubscriptionQuery parses repeated powerIds and optional systemIds', () => {
  const query = new URLSearchParams(
    'eventType=systemPowerplayUpdated&powerId=p1&powerId=p2&systemId=s1&systemId=s2'
  )

  const parsed = parseSseSubscriptionQuery(query)
  assert.equal(parsed.success, true)

  if (!parsed.success) {
    return
  }

  assert.deepEqual(parsed.data, {
    eventType: 'systemPowerplayUpdated',
    powerIds: ['p1', 'p2'],
    systemIds: ['s1', 's2'],
  })
})

test('parseSseSubscriptionQuery deduplicates powerIds and systemIds', () => {
  const query = new URLSearchParams(
    'eventType=systemPowerplayUpdated&powerId=p1&powerId=p1&systemId=s1&systemId=s1'
  )

  const parsed = parseSseSubscriptionQuery(query)
  assert.equal(parsed.success, true)

  if (!parsed.success) {
    return
  }

  assert.deepEqual(parsed.data.powerIds, ['p1'])
  assert.deepEqual(parsed.data.systemIds, ['s1'])
})

test('parseSseSubscriptionQuery returns null systemIds when omitted', () => {
  const query = new URLSearchParams('eventType=systemPowerplayUpdated&powerId=p1')

  const parsed = parseSseSubscriptionQuery(query)
  assert.equal(parsed.success, true)

  if (!parsed.success) {
    return
  }

  assert.equal(parsed.data.systemIds, null)
})

test('parseSseSubscriptionQuery rejects missing powerIds', () => {
  const query = new URLSearchParams('eventType=systemPowerplayUpdated')

  const parsed = parseSseSubscriptionQuery(query)
  assert.equal(parsed.success, false)

  if (parsed.success) {
    return
  }

  assert.match(parsed.error, /powerId/i)
})

test('parseSseSubscriptionQuery rejects more than 20 systemIds', () => {
  const query = new URLSearchParams('eventType=systemPowerplayUpdated&powerId=p1')
  for (let i = 0; i < 21; i += 1) {
    query.append('systemId', `s-${i}`)
  }

  const parsed = parseSseSubscriptionQuery(query)
  assert.equal(parsed.success, false)

  if (parsed.success) {
    return
  }

  assert.match(parsed.error, /systemId/i)
})
