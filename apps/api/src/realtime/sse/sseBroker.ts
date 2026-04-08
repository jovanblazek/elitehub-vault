import type { ServerResponse } from 'node:http'
import logger from '../../utils/logger.js'
import {
  getRealtimeEventSpec,
  type RealtimeEventType,
  type SseConnectionFilter,
} from './eventRegistry.js'
import type { RoutedRealtimeEvent } from './redisSubscriptionManager.js'
import { captureSseException } from './sseTelemetry.js'

const HEARTBEAT_INTERVAL_MS = 15_000
const WRITE_TIMEOUT_MS = 10_000
const MAX_QUEUE_MESSAGES = 200
const MAX_QUEUE_BYTES = 1_048_576

type ConnectionId = string

export type SseCloseReason =
  | 'client_disconnect'
  | 'backpressure'
  | 'write_error'
  | 'server_shutdown'
  | 'quota_exceeded'

type SseConnection = {
  id: ConnectionId
  response: ServerResponse
  eventType: RealtimeEventType
  apiKeyId: string
  keyName: string
  routingKeys: Set<string>
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
  apiKeyId: string
  keyName: string
  routingKeys: string[]
  systemIds: string[] | null
}

type RoutingDemandManager = {
  start: () => void
  stop: () => Promise<void>
  incrementDemand: (eventType: RealtimeEventType, routingKey: string) => Promise<void>
  decrementDemand: (eventType: RealtimeEventType, routingKey: string) => Promise<void>
}

type SseBrokerCallbacks = {
  onConnectionOpened?: (event: {
    connectionId: string
    apiKeyId: string
    keyName: string
    eventType: RealtimeEventType
    routingKeyCount: number
    systemIdCount: number
    activeChannels: number
  }) => void
  onConnectionClosed?: (event: {
    connectionId: string
    apiKeyId: string
    keyName: string
    reason: SseCloseReason
    activeChannels: number
  }) => void
  onEventRouted?: () => void
  onEventDropped?: () => void
  onWriteError?: () => void
}

const getChannelKey = (eventType: string, routingKey: string) => `${eventType}:${routingKey}`

const createSseEventFrame = (eventType: string, eventId: number, data: string) =>
  `id: ${eventId}\nevent: ${eventType}\ndata: ${data}\n\n`

export class SseBroker {
  private readonly connectionsById = new Map<ConnectionId, SseConnection>()
  private readonly connectionIdsByChannelKey = new Map<string, Set<ConnectionId>>()
  private nextConnectionId = 1

  constructor(
    private readonly redisSubscriptions: RoutingDemandManager,
    private readonly callbacks: SseBrokerCallbacks = {}
  ) {
    this.redisSubscriptions.start()
  }

  async registerConnection(input: RegisterConnectionInput): Promise<ConnectionId> {
    const connectionId = `${Date.now()}-${this.nextConnectionId++}`
    const systemIdAllowlist = input.systemIds ? new Set(input.systemIds) : null

    const connection: SseConnection = {
      id: connectionId,
      response: input.response,
      eventType: input.eventType,
      apiKeyId: input.apiKeyId,
      keyName: input.keyName,
      routingKeys: new Set(input.routingKeys),
      systemIdAllowlist,
      queue: [],
      queuedBytes: 0,
      isFlushing: false,
      isClosed: false,
      heartbeat: null,
      nextEventId: 1,
    }

    this.connectionsById.set(connectionId, connection)

    for (const routingKey of connection.routingKeys) {
      const channelKey = getChannelKey(connection.eventType, routingKey)
      let connectionIds = this.connectionIdsByChannelKey.get(channelKey)
      if (!connectionIds) {
        connectionIds = new Set<ConnectionId>()
        this.connectionIdsByChannelKey.set(channelKey, connectionIds)
      }
      connectionIds.add(connectionId)
    }

    try {
      await Promise.all(
        Array.from(connection.routingKeys, (routingKey) =>
          this.redisSubscriptions.incrementDemand(connection.eventType, routingKey)
        )
      )
    } catch (error) {
      captureSseException(error, {
        component: 'sse-broker',
        tags: {
          operation: 'register_connection',
          error_type: 'increment_power_demand_failed',
          event_type: connection.eventType,
        },
        contexts: {
          sse_connection: {
            connectionId,
            apiKeyId: connection.apiKeyId,
            eventType: connection.eventType,
            routingKeyCount: connection.routingKeys.size,
            systemIdCount: connection.systemIdAllowlist ? connection.systemIdAllowlist.size : 0,
          },
        },
        fingerprint: ['sse', 'broker', 'increment_power_demand_failed'],
      })
      logger.error(error, '[SSE] Failed to increment routing demand for new connection')
      await this.cleanupConnection(connectionId, 'write_error')
      throw error
    }

    this.enqueueRawFrame(connectionId, 'retry: 2000\n\n')
    this.enqueueRawFrame(connectionId, ': connected\n\n')
    connection.heartbeat = setInterval(() => {
      this.enqueueRawFrame(connectionId, ': keepalive\n\n')
    }, HEARTBEAT_INTERVAL_MS)

    this.callbacks.onConnectionOpened?.({
      connectionId,
      apiKeyId: connection.apiKeyId,
      keyName: connection.keyName,
      eventType: connection.eventType,
      routingKeyCount: connection.routingKeys.size,
      systemIdCount: connection.systemIdAllowlist ? connection.systemIdAllowlist.size : 0,
      activeChannels: this.connectionIdsByChannelKey.size,
    })

    return connectionId
  }

  routeEvent(event: RoutedRealtimeEvent) {
    const channelKey = getChannelKey(event.eventType, event.routingKey)
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
      this.callbacks.onEventRouted?.()
      this.enqueueRawFrame(connectionId, frame)
    }
  }

  async closeAllConnections() {
    const connectionIds = Array.from(this.connectionsById.keys())
    await Promise.all(
      connectionIds.map((connectionId) => this.cleanupConnection(connectionId, 'server_shutdown'))
    )
    await this.redisSubscriptions.stop()
  }

  async cleanupConnection(
    connectionId: ConnectionId,
    reason: SseCloseReason = 'client_disconnect'
  ) {
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

    for (const routingKey of connection.routingKeys) {
      const channelKey = getChannelKey(connection.eventType, routingKey)
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
      Array.from(connection.routingKeys, (routingKey) =>
        this.redisSubscriptions.decrementDemand(connection.eventType, routingKey)
      )
    )

    this.callbacks.onConnectionClosed?.({
      connectionId,
      apiKeyId: connection.apiKeyId,
      keyName: connection.keyName,
      reason,
      activeChannels: this.connectionIdsByChannelKey.size,
    })
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
      this.callbacks.onEventDropped?.()
      logger.warn({ connectionId }, '[SSE] Closing slow client due to backpressure threshold')
      void this.cleanupConnection(connectionId, 'backpressure')
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
      this.callbacks.onWriteError?.()
      captureSseException(error, {
        component: 'sse-broker',
        tags: {
          operation: 'flush_connection_queue',
          close_reason: 'write_error',
          event_type: connection.eventType,
          error_type: 'flush_write_failure',
        },
        contexts: {
          sse_connection: {
            connectionId,
            apiKeyId: connection.apiKeyId,
            eventType: connection.eventType,
            routingKeyCount: connection.routingKeys.size,
            systemIdCount: connection.systemIdAllowlist ? connection.systemIdAllowlist.size : 0,
          },
          sse_queue: {
            queuedBytes: connection.queuedBytes,
            queuedMessages: connection.queue.length,
            maxQueuedBytes: MAX_QUEUE_BYTES,
            maxQueuedMessages: MAX_QUEUE_MESSAGES,
          },
        },
        fingerprint: ['sse', 'broker', 'flush_write_failure'],
      })
      logger.warn({ error, connectionId }, '[SSE] Closing connection due to write failure')
      await this.cleanupConnection(connectionId, 'write_error')
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
