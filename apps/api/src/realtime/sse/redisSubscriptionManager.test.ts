import assert from 'node:assert/strict'
import { test } from 'vitest'
import { EventEmitter } from 'node:events'
import {
  RedisSubscriptionManager,
  type RedisSubscriberLike,
  type RoutedRealtimeEvent,
} from './redisSubscriptionManager.js'
import { __setSseTelemetryClientForTests } from './sseTelemetry.js'

class FakeRedisSubscriber extends EventEmitter {
  public readonly subscribedChannels: string[] = []
  public readonly unsubscribedChannels: string[] = []

  async subscribe(...args: unknown[]): Promise<number> {
    const [channel] = args
    this.subscribedChannels.push(String(channel))
    return this.subscribedChannels.length
  }

  async unsubscribe(...args: unknown[]): Promise<number> {
    const [channel] = args
    this.unsubscribedChannels.push(String(channel))
    return this.unsubscribedChannels.length
  }

  async quit(): Promise<'OK'> {
    return 'OK'
  }
}

class FlakySubscribeRedisSubscriber extends FakeRedisSubscriber {
  private subscribeAttempts = 0

  override async subscribe(...args: unknown[]): Promise<number> {
    const [channel] = args
    this.subscribeAttempts += 1
    if (this.subscribeAttempts === 1) {
      throw new Error('temporary subscribe failure')
    }
    return super.subscribe(channel)
  }
}

test('RedisSubscriptionManager subscribes only on first demand and unsubscribes on last demand', async () => {
  const fakeSubscriber = new FakeRedisSubscriber()
  const routedEvents: RoutedRealtimeEvent[] = []
  const manager = new RedisSubscriptionManager(
    fakeSubscriber as unknown as RedisSubscriberLike,
    (event) => {
      routedEvents.push(event)
    }
  )

  manager.start()

  await manager.incrementDemand('factionStateChanged', 'faction-a')
  await manager.incrementDemand('factionStateChanged', 'faction-a')

  assert.deepEqual(fakeSubscriber.subscribedChannels, [
    'events:factionStateChanged:faction:faction-a',
  ])

  await manager.decrementDemand('factionStateChanged', 'faction-a')
  assert.equal(fakeSubscriber.unsubscribedChannels.length, 0)

  await manager.decrementDemand('factionStateChanged', 'faction-a')
  assert.deepEqual(fakeSubscriber.unsubscribedChannels, [
    'events:factionStateChanged:faction:faction-a',
  ])

  fakeSubscriber.emit(
    'message',
    'events:factionStateChanged:faction:faction-a',
    JSON.stringify({
      event: 'factionStateChanged',
      factionId: 'faction-a',
      systemId: 'system-1',
      stateKind: 'state',
      state: 'Retreat',
      lifecycle: 'active',
      timestamp: '2026-04-04T00:00:00.000Z',
    })
  )

  assert.equal(routedEvents.length, 1)
  assert.equal(routedEvents[0]?.routingKey, 'faction-a')

  await manager.stop()
})

test('RedisSubscriptionManager retries subscribe on later demand after first subscribe failure', async () => {
  const fakeSubscriber = new FlakySubscribeRedisSubscriber()
  const manager = new RedisSubscriptionManager(
    fakeSubscriber as unknown as RedisSubscriberLike,
    () => {}
  )

  manager.start()

  await manager.incrementDemand('systemPowerplayUpdated', 'power-a')
  assert.equal(fakeSubscriber.subscribedChannels.length, 0)

  await manager.incrementDemand('systemPowerplayUpdated', 'power-a')
  assert.deepEqual(fakeSubscriber.subscribedChannels, [
    'events:systemPowerplayUpdated:power:power-a',
  ])

  await manager.stop()
})

test('RedisSubscriptionManager resubscribes demanded routing keys on ready', async () => {
  const fakeSubscriber = new FakeRedisSubscriber()
  const manager = new RedisSubscriptionManager(
    fakeSubscriber as unknown as RedisSubscriberLike,
    () => {}
  )

  manager.start()
  await manager.incrementDemand('factionPresenceChanged', 'faction-a')
  assert.equal(fakeSubscriber.subscribedChannels.length, 1)

  fakeSubscriber.emit('close')
  fakeSubscriber.emit('ready')

  await new Promise((resolve) => setTimeout(resolve, 5))

  assert.deepEqual(fakeSubscriber.subscribedChannels, [
    'events:factionPresenceChanged:faction:faction-a',
    'events:factionPresenceChanged:faction:faction-a',
  ])

  await manager.stop()
})

test('RedisSubscriptionManager captures telemetry for subscriber errors', async () => {
  const exceptions: Array<{ error: unknown; options: unknown }> = []
  try {
    __setSseTelemetryClientForTests({
      captureException: (error, options) => {
        exceptions.push({ error, options })
        return 'event-exception'
      },
      captureMessage: () => 'event-message',
      startSpan: async (_options, callback) => callback(),
    })

    const fakeSubscriber = new FakeRedisSubscriber()
    const manager = new RedisSubscriptionManager(
      fakeSubscriber as unknown as RedisSubscriberLike,
      () => {}
    )

    manager.start()
    await manager.incrementDemand('factionControlThreatChanged', 'faction-a')

    fakeSubscriber.emit('close')
    fakeSubscriber.emit('ready')
    fakeSubscriber.emit('error', new Error('redis broken'))

    await new Promise((resolve) => setTimeout(resolve, 10))

    assert.ok(exceptions.length > 0)

    await manager.stop()
  } finally {
    __setSseTelemetryClientForTests(null)
  }
})
