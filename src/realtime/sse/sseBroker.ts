import type { ServerResponse } from 'node:http'
import logger from '../../utils/logger.js'
import {
  getRealtimeEventSpec,
  type RealtimeEventType,
  type SseConnectionFilter,
} from './eventRegistry.js'
import type { RoutedRealtimeEvent } from './redisSubscriptionManager.js'

const HEARTBEAT_INTERVAL_MS = 15_000
const WRITE_TIMEOUT_MS = 10_000
const MAX_QUEUE_MESSAGES = 200
const MAX_QUEUE_BYTES = 1_048_576

type ConnectionId = string

type SseConnection = {
  id: ConnectionId
  response: ServerResponse
  eventType: RealtimeEventType
  powerIds: Set<string>
  systemIdAllowlist: Set<string> | null
  queue: string[]
  queuedBytes: number
  isFlushing: boolean
  isClosed: boolean
  heartbeat: NodeJS.Timeout | null
  nextEventId: number
}

export type RegisterConnectionInput = {
  response: ServerResponse
  eventType: RealtimeEventType
  powerIds: string[]
  systemIds: string[] | null
}

type PowerDemandManager = {
  start: () => void
  stop: () => Promise<void>
  incrementPowerDemand: (powerId: string) => Promise<void>
  decrementPowerDemand: (powerId: string) => Promise<void>
}

const getChannelKey = (eventType: string, powerId: string) => `${eventType}:${powerId}`

const createSseEventFrame = (eventType: string, eventId: number, data: string) =>
  `id: ${eventId}\nevent: ${eventType}\ndata: ${data}\n\n`

export class SseBroker {
  private readonly connectionsById = new Map<ConnectionId, SseConnection>()
  private readonly connectionIdsByChannelKey = new Map<string, Set<ConnectionId>>()
  private nextConnectionId = 1

  constructor(private readonly redisSubscriptions: PowerDemandManager) {
    this.redisSubscriptions.start()
  }

  async registerConnection(input: RegisterConnectionInput): Promise<ConnectionId> {
    const connectionId = `${Date.now()}-${this.nextConnectionId++}`
    const systemIdAllowlist = input.systemIds ? new Set(input.systemIds) : null

    const connection: SseConnection = {
      id: connectionId,
      response: input.response,
      eventType: input.eventType,
      powerIds: new Set(input.powerIds),
      systemIdAllowlist,
      queue: [],
      queuedBytes: 0,
      isFlushing: false,
      isClosed: false,
      heartbeat: null,
      nextEventId: 1,
    }

    this.connectionsById.set(connectionId, connection)

    for (const powerId of connection.powerIds) {
      const channelKey = getChannelKey(connection.eventType, powerId)
      let connectionIds = this.connectionIdsByChannelKey.get(channelKey)
      if (!connectionIds) {
        connectionIds = new Set<ConnectionId>()
        this.connectionIdsByChannelKey.set(channelKey, connectionIds)
      }
      connectionIds.add(connectionId)
    }

    try {
      await Promise.all(
        Array.from(connection.powerIds, (powerId) =>
          this.redisSubscriptions.incrementPowerDemand(powerId)
        )
      )
    } catch (error) {
      logger.error(error, '[SSE] Failed to increment power demand for new connection')
      await this.cleanupConnection(connectionId)
      throw error
    }

    this.enqueueRawFrame(connectionId, ': connected\n\n')
    connection.heartbeat = setInterval(() => {
      this.enqueueRawFrame(connectionId, ': keepalive\n\n')
    }, HEARTBEAT_INTERVAL_MS)

    return connectionId
  }

  routeEvent(event: RoutedRealtimeEvent) {
    const channelKey = getChannelKey(event.eventType, event.powerId)
    const connectionIds = this.connectionIdsByChannelKey.get(channelKey)
    if (!connectionIds || connectionIds.size === 0) {
      return
    }

    const spec = getRealtimeEventSpec(event.eventType)
    if (!spec) {
      return
    }

    const payload = event.payload

    for (const connectionId of connectionIds) {
      const connection = this.connectionsById.get(connectionId)
      if (!connection || connection.isClosed) {
        continue
      }

      const filterView: SseConnectionFilter = {
        systemIdAllowlist: connection.systemIdAllowlist,
      }

      if (!spec.matchesConnectionFilters(filterView, payload)) {
        continue
      }

      const frame = createSseEventFrame(
        spec.eventType,
        connection.nextEventId++,
        spec.toSseData(payload)
      )
      this.enqueueRawFrame(connectionId, frame)
    }
  }

  async closeAllConnections() {
    const connectionIds = Array.from(this.connectionsById.keys())
    await Promise.all(connectionIds.map((connectionId) => this.cleanupConnection(connectionId)))
    await this.redisSubscriptions.stop()
  }

  async cleanupConnection(connectionId: ConnectionId) {
    const connection = this.connectionsById.get(connectionId)
    if (!connection || connection.isClosed) {
      return
    }

    connection.isClosed = true
    this.connectionsById.delete(connectionId)

    if (connection.heartbeat) {
      clearInterval(connection.heartbeat)
      connection.heartbeat = null
    }

    for (const powerId of connection.powerIds) {
      const channelKey = getChannelKey(connection.eventType, powerId)
      const connectionIds = this.connectionIdsByChannelKey.get(channelKey)
      if (!connectionIds) {
        continue
      }

      connectionIds.delete(connectionId)
      if (connectionIds.size === 0) {
        this.connectionIdsByChannelKey.delete(channelKey)
      }
    }

    connection.queue = []
    connection.queuedBytes = 0

    try {
      if (!connection.response.writableEnded) {
        connection.response.end()
      }
    } catch (error) {
      logger.debug({ error }, '[SSE] Failed to close SSE response stream')
    }

    await Promise.all(
      Array.from(connection.powerIds, (powerId) =>
        this.redisSubscriptions.decrementPowerDemand(powerId)
      )
    )
  }

  private enqueueRawFrame(connectionId: ConnectionId, frame: string) {
    const connection = this.connectionsById.get(connectionId)
    if (!connection || connection.isClosed) {
      return
    }

    const frameBytes = Buffer.byteLength(frame, 'utf8')
    if (
      connection.queue.length + 1 > MAX_QUEUE_MESSAGES ||
      connection.queuedBytes + frameBytes > MAX_QUEUE_BYTES
    ) {
      logger.warn({ connectionId }, '[SSE] Closing slow client due to backpressure threshold')
      void this.cleanupConnection(connectionId)
      return
    }

    connection.queue.push(frame)
    connection.queuedBytes += frameBytes

    if (!connection.isFlushing) {
      void this.flushConnectionQueue(connectionId)
    }
  }

  private async flushConnectionQueue(connectionId: ConnectionId) {
    const connection = this.connectionsById.get(connectionId)
    if (!connection || connection.isClosed || connection.isFlushing) {
      return
    }

    connection.isFlushing = true

    try {
      while (connection.queue.length > 0) {
        const frame = connection.queue.shift()
        if (!frame) {
          continue
        }

        connection.queuedBytes -= Buffer.byteLength(frame, 'utf8')

        // oxlint-disable-next-line no-await-in-loop
        await this.writeFrame(connection, frame)
        if (connection.isClosed) {
          return
        }
      }
    } catch (error) {
      logger.warn({ error, connectionId }, '[SSE] Closing connection due to write failure')
      await this.cleanupConnection(connectionId)
    } finally {
      connection.isFlushing = false
    }
  }

  private async writeFrame(connection: SseConnection, frame: string) {
    if (connection.isClosed || connection.response.writableEnded) {
      return
    }

    let timeout: NodeJS.Timeout | null = null
    await new Promise<void>((resolve, reject) => {
      timeout = setTimeout(() => {
        reject(new Error('SSE write timeout'))
      }, WRITE_TIMEOUT_MS)

      connection.response.write(frame, (error) => {
        if (timeout) {
          clearTimeout(timeout)
        }

        if (error) {
          reject(error)
          return
        }

        resolve()
      })
    })
  }
}
