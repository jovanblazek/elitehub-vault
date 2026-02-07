import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import test from 'node:test'
import type { ServerResponse } from 'node:http'
import { SseBroker } from './sseBroker.js'

type FakeDemandManager = {
  start: () => void
  stop: () => Promise<void>
  incrementPowerDemand: (powerId: string) => Promise<void>
  decrementPowerDemand: (powerId: string) => Promise<void>
  increments: string[]
  decrements: string[]
}

const createFakeDemandManager = (): FakeDemandManager => ({
  increments: [],
  decrements: [],
  start: () => {},
  stop: async () => {},
  // oxlint-disable-next-line consistent-function-scoping
  incrementPowerDemand: async function incrementPowerDemand(powerId: string) {
    this.increments.push(powerId)
  },
  // oxlint-disable-next-line consistent-function-scoping
  decrementPowerDemand: async function decrementPowerDemand(powerId: string) {
    this.decrements.push(powerId)
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

const getDataFrames = (frames: string[]) =>
  frames.filter((frame) => frame.includes('event: systemPowerplayUpdated'))

test('SseBroker filters routed events by powerId and optional systemId', async () => {
  const demandManager = createFakeDemandManager()
  const broker = new SseBroker(demandManager)

  const response1 = new FakeResponse()
  const response2 = new FakeResponse()

  const connection1 = await broker.registerConnection({
    response: response1 as unknown as ServerResponse,
    eventType: 'systemPowerplayUpdated',
    apiKeyId: 'key-1',
    keyName: 'key-1',
    powerIds: ['power-a'],
    systemIds: ['system-1'],
  })

  const connection2 = await broker.registerConnection({
    response: response2 as unknown as ServerResponse,
    eventType: 'systemPowerplayUpdated',
    apiKeyId: 'key-2',
    keyName: 'key-2',
    powerIds: ['power-a'],
    systemIds: null,
  })

  broker.routeEvent({
    eventType: 'systemPowerplayUpdated',
    powerId: 'power-a',
    payload: {
      event: 'systemPowerplayUpdated',
      systemId: 'system-2',
      powerId: 'power-a',
      changedFields: ['powerplayState'],
      timestamp: '2026-02-07T00:00:00.000Z',
      source: 'eddn-worker',
      metadata: {},
    },
  })

  await new Promise((resolve) => setTimeout(resolve, 10))

  assert.equal(getDataFrames(response1.frames).length, 0)
  assert.equal(getDataFrames(response2.frames).length, 1)

  await broker.cleanupConnection(connection1)
  await broker.cleanupConnection(connection2)
})

test('SseBroker without systemId filter receives all systems for selected powerIds', async () => {
  const demandManager = createFakeDemandManager()
  const broker = new SseBroker(demandManager)
  const response = new FakeResponse()

  const connectionId = await broker.registerConnection({
    response: response as unknown as ServerResponse,
    eventType: 'systemPowerplayUpdated',
    apiKeyId: 'key-1',
    keyName: 'key-1',
    powerIds: ['power-a', 'power-b'],
    systemIds: null,
  })

  broker.routeEvent({
    eventType: 'systemPowerplayUpdated',
    powerId: 'power-a',
    payload: {
      event: 'systemPowerplayUpdated',
      systemId: 'system-1',
      powerId: 'power-a',
      changedFields: ['powerplayState'],
      timestamp: '2026-02-07T00:00:00.000Z',
      source: 'eddn-worker',
      metadata: {},
    },
  })

  broker.routeEvent({
    eventType: 'systemPowerplayUpdated',
    powerId: 'power-b',
    payload: {
      event: 'systemPowerplayUpdated',
      systemId: 'system-2',
      powerId: 'power-b',
      changedFields: ['powerplayStateUndermining'],
      timestamp: '2026-02-07T00:00:01.000Z',
      source: 'eddn-worker',
      metadata: {},
    },
  })

  await new Promise((resolve) => setTimeout(resolve, 10))

  assert.equal(getDataFrames(response.frames).length, 2)

  await broker.cleanupConnection(connectionId)
})

test('SseBroker cleanup is idempotent and decrements power demand once per power', async () => {
  const demandManager = createFakeDemandManager()
  const broker = new SseBroker(demandManager)
  const response = new FakeResponse()

  const connectionId = await broker.registerConnection({
    response: response as unknown as ServerResponse,
    eventType: 'systemPowerplayUpdated',
    apiKeyId: 'key-1',
    keyName: 'key-1',
    powerIds: ['power-a', 'power-b'],
    systemIds: null,
  })

  assert.deepEqual(demandManager.increments, ['power-a', 'power-b'])

  await broker.cleanupConnection(connectionId)
  await broker.cleanupConnection(connectionId)

  assert.deepEqual(demandManager.decrements, ['power-a', 'power-b'])
  assert.equal(response.writableEnded, true)
})
