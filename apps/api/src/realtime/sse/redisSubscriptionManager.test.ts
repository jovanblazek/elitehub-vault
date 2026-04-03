import assert from 'node:assert/strict'
import test from 'node:test'
import { EventEmitter } from 'node:events'
import {
  RedisSubscriptionManager,
  type RedisSubscriberLike,
  type RoutedRealtimeEvent,
} from './redisSubscriptionManager.js'
import { __setSseTelemetryClientForTests } from './sseTelemetry.js'

class FakeRedisSubscriber extends EventEmitter implements RedisSubscriberLike {
  public readonly subscribedChannels: string[] = []
  public readonly unsubscribedChannels: string[] = []

  // @ts-expect-error - This is ok for the test
  async subscribe(channel: string): Promise<number> {
    this.subscribedChannels.push(channel)
    return this.subscribedChannels.length
  }

  // @ts-expect-error - This is ok for the test
  async unsubscribe(channel: string): Promise<number> {
    this.unsubscribedChannels.push(channel)
    return this.unsubscribedChannels.length
  }

  async quit(): Promise<'OK'> {
    return 'OK'
  }
}

class FlakySubscribeRedisSubscriber extends FakeRedisSubscriber {
  private subscribeAttempts = 0

  override async subscribe(channel: string): Promise<number> {
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

  await manager.incrementPowerDemand('power-a')
  await manager.incrementPowerDemand('power-a')

  assert.deepEqual(fakeSubscriber.subscribedChannels, [
    'events:systemPowerplayUpdated:power:power-a',
  ])

  await manager.decrementPowerDemand('power-a')
  assert.equal(fakeSubscriber.unsubscribedChannels.length, 0)

  await manager.decrementPowerDemand('power-a')
  assert.deepEqual(fakeSubscriber.unsubscribedChannels, [
    'events:systemPowerplayUpdated:power:power-a',
  ])

  fakeSubscriber.emit(
    'message',
    'events:systemPowerplayUpdated:power:power-a',
    JSON.stringify({
      event: 'systemPowerplayUpdated',
      systemId: 'system-1',
      powerId: 'power-a',
      changedFields: ['powerplayState'],
      timestamp: '2026-02-07T00:00:00.000Z',
      source: 'eddn-worker',
      metadata: {},
    })
  )

  assert.equal(routedEvents.length, 1)
  assert.equal(routedEvents[0]?.powerId, 'power-a')

  await manager.stop()
})

test('RedisSubscriptionManager retries subscribe on later demand after first subscribe failure', async () => {
  const fakeSubscriber = new FlakySubscribeRedisSubscriber()
  const manager = new RedisSubscriptionManager(
    fakeSubscriber as unknown as RedisSubscriberLike,
    () => {}
  )

  manager.start()

  await manager.incrementPowerDemand('power-a')
  assert.equal(fakeSubscriber.subscribedChannels.length, 0)

  await manager.incrementPowerDemand('power-a')
  assert.deepEqual(fakeSubscriber.subscribedChannels, [
    'events:systemPowerplayUpdated:power:power-a',
  ])

  await manager.stop()
})

test('RedisSubscriptionManager resubscribes demanded powers on ready', async () => {
  const fakeSubscriber = new FakeRedisSubscriber()
  const manager = new RedisSubscriptionManager(
    fakeSubscriber as unknown as RedisSubscriberLike,
    () => {}
  )

  manager.start()
  await manager.incrementPowerDemand('power-a')
  assert.equal(fakeSubscriber.subscribedChannels.length, 1)

  fakeSubscriber.emit('close')
  fakeSubscriber.emit('ready')

  await new Promise((resolve) => setTimeout(resolve, 5))

  assert.equal(fakeSubscriber.subscribedChannels.length, 2)
  assert.deepEqual(fakeSubscriber.subscribedChannels, [
    'events:systemPowerplayUpdated:power:power-a',
    'events:systemPowerplayUpdated:power:power-a',
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
    await manager.incrementPowerDemand('power-a')

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
