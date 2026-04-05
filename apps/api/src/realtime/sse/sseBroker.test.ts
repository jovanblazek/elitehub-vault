import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import test from 'node:test'
import type { ServerResponse } from 'node:http'
import { SseBroker } from './sseBroker.js'
import { __setSseTelemetryClientForTests } from './sseTelemetry.js'

type FakeDemandManager = {
  start: () => void
  stop: () => Promise<void>
  incrementDemand: (eventType: string, routingKey: string) => Promise<void>
  decrementDemand: (eventType: string, routingKey: string) => Promise<void>
  increments: string[]
  decrements: string[]
}

const createFakeDemandManager = (): FakeDemandManager => ({
  increments: [],
  decrements: [],
  start: () => {},
  stop: async () => {},
  // oxlint-disable-next-line consistent-function-scoping
  incrementDemand: async function incrementDemand(eventType: string, routingKey: string) {
    this.increments.push(`${eventType}:${routingKey}`)
  },
  // oxlint-disable-next-line consistent-function-scoping
  decrementDemand: async function decrementDemand(eventType: string, routingKey: string) {
    this.decrements.push(`${eventType}:${routingKey}`)
  },
})

class FakeResponse extends EventEmitter {
  public writableEnded = false
  public readonly frames: string[] = []

  write(frame: string, callback?: (error?: Error | null) => void): boolean {
    this.frames.push(frame)
    if (callback) {
      setImmediate(() => callback())
    }
    return true
  }

  end() {
    this.writableEnded = true
    this.emit('close')
  }
}

class ErroringResponse extends EventEmitter {
  public writableEnded = false

  write(_frame: string, callback?: (error?: Error | null) => void): boolean {
    if (callback) {
      setImmediate(() => callback(new Error('write failed')))
    }
    return false
  }

  end() {
    this.writableEnded = true
    this.emit('close')
  }
}

class NonFlushingResponse extends EventEmitter {
  public writableEnded = false

  write(_frame: string, _callback?: (error?: Error | null) => void): boolean {
    return false
  }

  end() {
    this.writableEnded = true
    this.emit('close')
  }
}

const getDataFrames = (frames: string[], eventType: string) =>
  frames.filter((frame) => frame.includes(`event: ${eventType}`))

test('SseBroker filters faction events by routing key and optional systemId', async () => {
  const demandManager = createFakeDemandManager()
  const broker = new SseBroker(demandManager)

  const response1 = new FakeResponse()
  const response2 = new FakeResponse()

  const connection1 = await broker.registerConnection({
    response: response1 as unknown as ServerResponse,
    eventType: 'factionStateChanged',
    apiKeyId: 'key-1',
    keyName: 'key-1',
    routingKeys: ['faction-a'],
    systemIds: ['system-1'],
  })

  const connection2 = await broker.registerConnection({
    response: response2 as unknown as ServerResponse,
    eventType: 'factionStateChanged',
    apiKeyId: 'key-2',
    keyName: 'key-2',
    routingKeys: ['faction-a'],
    systemIds: null,
  })

  broker.routeEvent({
    eventType: 'factionStateChanged',
    routingKey: 'faction-a',
    payload: {
      event: 'factionStateChanged',
      factionId: 'faction-a',
      systemId: 'system-2',
      stateKind: 'state',
      state: 'Retreat',
      lifecycle: 'active',
      timestamp: '2026-04-04T00:00:00.000Z',
    },
  })

  await new Promise((resolve) => setTimeout(resolve, 10))

  assert.equal(getDataFrames(response1.frames, 'factionStateChanged').length, 0)
  assert.equal(getDataFrames(response2.frames, 'factionStateChanged').length, 1)

  await broker.cleanupConnection(connection1)
  await broker.cleanupConnection(connection2)
})

test('SseBroker keeps existing powerplay routing behavior', async () => {
  const demandManager = createFakeDemandManager()
  const broker = new SseBroker(demandManager)
  const response = new FakeResponse()

  const connectionId = await broker.registerConnection({
    response: response as unknown as ServerResponse,
    eventType: 'systemPowerplayUpdated',
    apiKeyId: 'key-1',
    keyName: 'key-1',
    routingKeys: ['power-a', 'power-b'],
    systemIds: null,
  })

  broker.routeEvent({
    eventType: 'systemPowerplayUpdated',
    routingKey: 'power-a',
    payload: {
      event: 'systemPowerplayUpdated',
      systemId: 'system-1',
      powerId: 'power-a',
      changedFields: ['powerplayState'],
      timestamp: '2026-02-07T00:00:00.000Z',
      metadata: {},
    },
  })

  broker.routeEvent({
    eventType: 'systemPowerplayUpdated',
    routingKey: 'power-b',
    payload: {
      event: 'systemPowerplayUpdated',
      systemId: 'system-2',
      powerId: 'power-b',
      changedFields: ['powerplayStateUndermining'],
      timestamp: '2026-02-07T00:00:01.000Z',
      metadata: {},
    },
  })

  await new Promise((resolve) => setTimeout(resolve, 10))

  assert.equal(getDataFrames(response.frames, 'systemPowerplayUpdated').length, 2)

  await broker.cleanupConnection(connectionId)
})

test('SseBroker cleanup is idempotent and decrements demand once per routing key', async () => {
  const demandManager = createFakeDemandManager()
  const broker = new SseBroker(demandManager)
  const response = new FakeResponse()

  const connectionId = await broker.registerConnection({
    response: response as unknown as ServerResponse,
    eventType: 'factionPresenceChanged',
    apiKeyId: 'key-1',
    keyName: 'key-1',
    routingKeys: ['faction-a', 'faction-b'],
    systemIds: null,
  })

  assert.deepEqual(demandManager.increments, [
    'factionPresenceChanged:faction-a',
    'factionPresenceChanged:faction-b',
  ])

  await broker.cleanupConnection(connectionId)
  await broker.cleanupConnection(connectionId)

  assert.deepEqual(demandManager.decrements, [
    'factionPresenceChanged:faction-a',
    'factionPresenceChanged:faction-b',
  ])
  assert.equal(response.writableEnded, true)
})

test('SseBroker closes connection on backpressure threshold', async () => {
  const demandManager = createFakeDemandManager()
  const broker = new SseBroker(demandManager)
  const response = new NonFlushingResponse()

  const connectionId = await broker.registerConnection({
    response: response as unknown as ServerResponse,
    eventType: 'factionStateChanged',
    apiKeyId: 'key-1',
    keyName: 'key-1',
    routingKeys: ['faction-a'],
    systemIds: null,
  })

  for (let i = 0; i < 250; i += 1) {
    broker.routeEvent({
      eventType: 'factionStateChanged',
      routingKey: 'faction-a',
      payload: {
        event: 'factionStateChanged',
        factionId: 'faction-a',
        systemId: `system-${i}`,
        stateKind: 'state',
        state: 'Retreat',
        lifecycle: 'pending',
        timestamp: '2026-04-04T00:00:00.000Z',
      },
    })
  }

  await new Promise((resolve) => setTimeout(resolve, 20))

  assert.equal(response.writableEnded, true)

  await broker.cleanupConnection(connectionId)
})

test('SseBroker captures telemetry on write failure', async () => {
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

    const demandManager = createFakeDemandManager()
    const broker = new SseBroker(demandManager)
    const response = new ErroringResponse()

    await broker.registerConnection({
      response: response as unknown as ServerResponse,
      eventType: 'factionControlThreatChanged',
      apiKeyId: 'key-1',
      keyName: 'key-1',
      routingKeys: ['faction-a'],
      systemIds: null,
    })

    broker.routeEvent({
      eventType: 'factionControlThreatChanged',
      routingKey: 'faction-a',
      payload: {
        event: 'factionControlThreatChanged',
        factionId: 'faction-a',
        systemId: 'system-1',
        status: 'entered',
        challengerFactionId: 'faction-b',
        gap: 0.08,
        threshold: 0.1,
        timestamp: '2026-04-04T00:00:00.000Z',
      },
    })

    await new Promise((resolve) => setTimeout(resolve, 20))

    assert.equal(response.writableEnded, true)
    assert.ok(exceptions.length > 0)
  } finally {
    __setSseTelemetryClientForTests(null)
  }
})
