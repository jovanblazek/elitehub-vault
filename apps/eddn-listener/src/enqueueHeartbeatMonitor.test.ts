import assert from 'node:assert/strict'
import { afterEach, test, vi } from 'vitest'
import { createEnqueueHeartbeatMonitor } from './enqueueHeartbeatMonitor.js'

afterEach(() => {
  vi.useRealTimers()
})

const createOkResponse = () => new Response(null, { status: 200 })

test('does not push uptime heartbeat before the first successful enqueue', async () => {
  vi.useFakeTimers()

  const fetch = vi.fn(async () => createOkResponse())
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }

  const monitor = createEnqueueHeartbeatMonitor({
    heartbeatIntervalMs: 30_000,
    statusLogIntervalMs: 60_000,
    kumaPushIntervalMs: 60_000,
    kumaPushUrl: 'https://uptime.example/push',
    fetch,
    logger,
    sentry: {
      captureMessage: vi.fn(),
      captureException: vi.fn(),
    },
  })

  monitor.start()

  await vi.advanceTimersByTimeAsync(120_000)

  assert.equal(fetch.mock.calls.length, 0)
  monitor.stop()
})

test('pushes a rate-limited uptime heartbeat only while recent enqueue activity exists', async () => {
  vi.useFakeTimers()

  const fetch = vi.fn(async () => createOkResponse())
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }

  const monitor = createEnqueueHeartbeatMonitor({
    heartbeatIntervalMs: 30_000,
    timeSinceLastJobQueuedThresholdMs: 120_000,
    statusLogIntervalMs: 60_000,
    kumaPushIntervalMs: 60_000,
    kumaPushUrl: 'https://uptime.example/push',
    fetch,
    logger,
    sentry: {
      captureMessage: vi.fn(),
      captureException: vi.fn(),
    },
  })

  monitor.start()
  monitor.markEnqueueSuccess()

  await vi.advanceTimersByTimeAsync(60_000)
  assert.equal(fetch.mock.calls.length, 1)

  monitor.markEnqueueSuccess()
  await vi.advanceTimersByTimeAsync(30_000)
  assert.equal(fetch.mock.calls.length, 1)

  await vi.advanceTimersByTimeAsync(30_000)
  assert.equal(fetch.mock.calls.length, 2)

  await vi.advanceTimersByTimeAsync(120_000)
  assert.equal(fetch.mock.calls.length, 2)

  monitor.stop()
})

test('emits periodic structured status logs', async () => {
  vi.useFakeTimers()

  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }

  const monitor = createEnqueueHeartbeatMonitor({
    heartbeatIntervalMs: 30_000,
    statusLogIntervalMs: 60_000,
    kumaPushIntervalMs: 60_000,
    fetch: vi.fn(async () => createOkResponse()),
    logger,
    sentry: {
      captureMessage: vi.fn(),
      captureException: vi.fn(),
    },
  })

  monitor.start()
  monitor.markEnqueueSuccess()

  await vi.advanceTimersByTimeAsync(60_000)

  const heartbeatLog = logger.info.mock.calls.find(
    ([, message]) => message === '[EDDN Listener] Heartbeat'
  )

  assert.ok(heartbeatLog)
  assert.equal(heartbeatLog[0].hasSeenSuccessfulEnqueue, true)
  assert.equal(typeof heartbeatLog[0].timeSinceLastJobQueuedMs, 'number')

  monitor.stop()
})
