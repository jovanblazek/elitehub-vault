import assert from 'node:assert/strict'
import { test } from 'vitest'
import { parseSseSubscriptionQuery } from './subscriptionParams.js'

test('parseSseSubscriptionQuery parses repeated power routing keys and optional systemIds', () => {
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
    routingKeyParam: 'powerId',
    routingKeys: ['p1', 'p2'],
    systemIds: ['s1', 's2'],
  })
})

test('parseSseSubscriptionQuery parses faction subscriptions', () => {
  const query = new URLSearchParams(
    'eventType=factionStateChanged&factionId=f1&factionId=f2&systemId=s1'
  )

  const parsed = parseSseSubscriptionQuery(query)
  assert.equal(parsed.success, true)

  if (!parsed.success) {
    return
  }

  assert.deepEqual(parsed.data, {
    eventType: 'factionStateChanged',
    routingKeyParam: 'factionId',
    routingKeys: ['f1', 'f2'],
    systemIds: ['s1'],
  })
})

test('parseSseSubscriptionQuery deduplicates routing keys and systemIds', () => {
  const query = new URLSearchParams(
    'eventType=factionPresenceChanged&factionId=f1&factionId=f1&systemId=s1&systemId=s1'
  )

  const parsed = parseSseSubscriptionQuery(query)
  assert.equal(parsed.success, true)

  if (!parsed.success) {
    return
  }

  assert.deepEqual(parsed.data.routingKeys, ['f1'])
  assert.deepEqual(parsed.data.systemIds, ['s1'])
})

test('parseSseSubscriptionQuery returns null systemIds when omitted', () => {
  const query = new URLSearchParams('eventType=factionControlThreatChanged&factionId=f1')

  const parsed = parseSseSubscriptionQuery(query)
  assert.equal(parsed.success, true)

  if (!parsed.success) {
    return
  }

  assert.equal(parsed.data.systemIds, null)
})

test('parseSseSubscriptionQuery rejects missing powerIds for powerplay', () => {
  const query = new URLSearchParams('eventType=systemPowerplayUpdated')

  const parsed = parseSseSubscriptionQuery(query)
  assert.equal(parsed.success, false)

  if (parsed.success) {
    return
  }

  assert.match(parsed.error, /powerId/i)
})

test('parseSseSubscriptionQuery rejects missing factionIds for faction events', () => {
  const query = new URLSearchParams('eventType=factionStateChanged')

  const parsed = parseSseSubscriptionQuery(query)
  assert.equal(parsed.success, false)

  if (parsed.success) {
    return
  }

  assert.match(parsed.error, /factionId/i)
})

test('parseSseSubscriptionQuery rejects more than 20 factionIds', () => {
  const query = new URLSearchParams('eventType=factionStateChanged')
  for (let i = 0; i < 21; i += 1) {
    query.append('factionId', `f-${i}`)
  }

  const parsed = parseSseSubscriptionQuery(query)
  assert.equal(parsed.success, false)

  if (parsed.success) {
    return
  }

  assert.match(parsed.error, /factionId/i)
})
