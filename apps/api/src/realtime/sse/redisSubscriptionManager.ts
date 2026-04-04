import type { Redis } from 'ioredis'
import type { RealtimePayload } from '@elitehub/queue-contracts'
import logger from '../../utils/logger.js'
import {
  findRealtimeEventByChannel,
  getRealtimeEventSpec,
  type RealtimeEventType,
} from './eventRegistry.js'
import { captureSseException } from './sseTelemetry.js'

type SubscriptionState = 'idle' | 'subscribing' | 'subscribed' | 'unsubscribing'

type DemandKey = `${RealtimeEventType}:${string}`

export type RoutedRealtimeEvent = {
  eventType: RealtimeEventType
  routingKey: string
  payload: RealtimePayload
}

export type RedisSubscriberLike = Pick<
  Redis,
  | 'subscribe'
  | 'unsubscribe'
  | 'quit'
  | 'on'
  | 'removeListener'
  | 'setMaxListeners'
>

const getDemandKey = (eventType: RealtimeEventType, routingKey: string): DemandKey =>
  `${eventType}:${routingKey}`

const parseDemandKey = (demandKey: DemandKey) => {
  const separatorIndex = demandKey.indexOf(':')
  return {
    eventType: demandKey.slice(0, separatorIndex) as RealtimeEventType,
    routingKey: demandKey.slice(separatorIndex + 1),
  }
}

export class RedisSubscriptionManager {
  private readonly subscriber: RedisSubscriberLike
  private readonly demandCount = new Map<DemandKey, number>()
  private readonly subscriptionStateByDemandKey = new Map<DemandKey, SubscriptionState>()
  private readonly subscriptionOpByDemandKey = new Map<DemandKey, Promise<void>>()
  private isStarted = false
  private redisDisconnected = false

  constructor(
    subscriber: RedisSubscriberLike,
    private readonly onEvent: (event: RoutedRealtimeEvent) => void,
    private readonly callbacks: {
      onRedisError?: () => void
      onRedisDisconnect?: () => void
      onRedisRecovered?: (demandedSubscriptions: number) => void
    } = {}
  ) {
    this.subscriber = subscriber
    this.subscriber.setMaxListeners(100)
  }

  start() {
    if (this.isStarted) {
      return
    }

    this.isStarted = true
    this.subscriber.on('message', this.onMessage)
    this.subscriber.on('ready', this.onReady)
    this.subscriber.on('error', this.onError)
    this.subscriber.on('close', this.onClose)
  }

  async stop() {
    if (!this.isStarted) {
      return
    }

    this.isStarted = false
    this.subscriber.removeListener('message', this.onMessage)
    this.subscriber.removeListener('ready', this.onReady)
    this.subscriber.removeListener('error', this.onError)
    this.subscriber.removeListener('close', this.onClose)

    this.demandCount.clear()
    this.subscriptionStateByDemandKey.clear()
    this.subscriptionOpByDemandKey.clear()

    await this.subscriber.quit()
  }

  async incrementDemand(eventType: RealtimeEventType, routingKey: string) {
    const demandKey = getDemandKey(eventType, routingKey)
    await this.runSerialized(demandKey, async () => {
      const current = this.demandCount.get(demandKey) ?? 0
      const next = current + 1
      this.demandCount.set(demandKey, next)
      await this.subscribeIfNeeded(demandKey)
    })
  }

  async decrementDemand(eventType: RealtimeEventType, routingKey: string) {
    const demandKey = getDemandKey(eventType, routingKey)
    await this.runSerialized(demandKey, async () => {
      const current = this.demandCount.get(demandKey) ?? 0
      if (current <= 0) {
        return
      }

      const next = current - 1
      if (next === 0) {
        this.demandCount.delete(demandKey)
        await this.unsubscribeIfNeeded(demandKey)
      } else {
        this.demandCount.set(demandKey, next)
      }
    })
  }

  private readonly onMessage = (channel: string, message: string) => {
    const match = findRealtimeEventByChannel(channel)
    if (!match) {
      return
    }

    const payload = match.spec.parsePayload(message)
    if (!payload) {
      logger.warn({ channel }, '[SSE] Failed to parse realtime payload from Redis')
      return
    }

    this.onEvent({
      eventType: match.eventType,
      routingKey: match.routingKey,
      payload,
    })
  }

  private readonly onReady = () => {
    const demandedSubscriptions = this.demandCount.size
    for (const demandKey of this.demandCount.keys()) {
      this.subscriptionStateByDemandKey.set(demandKey, 'idle')
    }

    if (this.redisDisconnected) {
      logger.info(
        { demandedSubscriptions },
        '[SSE] Redis subscriber recovered; reconciling subscriptions'
      )
      this.callbacks.onRedisRecovered?.(demandedSubscriptions)
      this.redisDisconnected = false
    }

    void this.reconcileAllSubscriptions()
  }

  private readonly onError = (error: unknown) => {
    this.callbacks.onRedisError?.()
    captureSseException(error, {
      component: 'sse-redis-subscriptions',
      tags: {
        operation: 'redis_error',
        error_type: 'subscriber_error',
        event_type: 'mixed',
      },
      contexts: {
        sse_redis: {
          demandedSubscriptions: this.demandCount.size,
        },
      },
      fingerprint: ['sse', 'redis_subscriptions', 'subscriber_error'],
    })
    logger.error(error, '[SSE] Redis subscriber error')
  }

  private readonly onClose = () => {
    this.redisDisconnected = true
    this.callbacks.onRedisDisconnect?.()
    logger.warn(
      { demandedSubscriptions: this.demandCount.size },
      '[SSE] Redis subscriber connection closed'
    )
    for (const [demandKey, state] of this.subscriptionStateByDemandKey.entries()) {
      if (state === 'subscribed' || state === 'subscribing') {
        this.subscriptionStateByDemandKey.set(demandKey, 'idle')
      }
    }
  }

  private async reconcileAllSubscriptions() {
    const demandedKeys = Array.from(this.demandCount.keys())
    await Promise.all(
      demandedKeys.map((demandKey) =>
        this.runSerialized(demandKey, async () => {
          await this.subscribeIfNeeded(demandKey)
        })
      )
    )

    if (this.isStarted) {
      logger.info(
        { demandedSubscriptions: demandedKeys.length },
        '[SSE] Redis subscription reconciliation complete'
      )
    }
  }

  private async subscribeIfNeeded(demandKey: DemandKey) {
    const currentDemand = this.demandCount.get(demandKey) ?? 0
    if (currentDemand <= 0) {
      return
    }

    const state = this.subscriptionStateByDemandKey.get(demandKey)
    if (state === 'subscribed' || state === 'subscribing') {
      return
    }

    const { eventType, routingKey } = parseDemandKey(demandKey)
    const spec = getRealtimeEventSpec(eventType)
    if (!spec) {
      return
    }

    this.subscriptionStateByDemandKey.set(demandKey, 'subscribing')
    const channel = spec.getChannel(routingKey)

    try {
      await this.subscriber.subscribe(channel)
      if ((this.demandCount.get(demandKey) ?? 0) > 0) {
        this.subscriptionStateByDemandKey.set(demandKey, 'subscribed')
      } else {
        this.subscriptionStateByDemandKey.set(demandKey, 'subscribed')
        await this.unsubscribeIfNeeded(demandKey)
      }
    } catch (error) {
      this.subscriptionStateByDemandKey.set(demandKey, 'idle')
      captureSseException(error, {
        component: 'sse-redis-subscriptions',
        tags: {
          operation: 'subscribe_channel',
          error_type: 'subscribe_failed',
          event_type: eventType,
        },
        contexts: {
          sse_redis: {
            eventType,
            routingKey,
            channel,
            demandedSubscriptions: this.demandCount.size,
            subscriptionState: 'idle',
          },
        },
        fingerprint: ['sse', 'redis_subscriptions', 'subscribe_failed'],
      })
      logger.error({ error, eventType, routingKey }, '[SSE] Failed subscribing to channel')
    }
  }

  private async unsubscribeIfNeeded(demandKey: DemandKey) {
    const currentDemand = this.demandCount.get(demandKey) ?? 0
    if (currentDemand > 0) {
      return
    }

    const state = this.subscriptionStateByDemandKey.get(demandKey)
    if (!state || state === 'idle' || state === 'unsubscribing') {
      return
    }

    const { eventType, routingKey } = parseDemandKey(demandKey)
    const spec = getRealtimeEventSpec(eventType)
    if (!spec) {
      return
    }

    const channel = spec.getChannel(routingKey)
    this.subscriptionStateByDemandKey.set(demandKey, 'unsubscribing')

    try {
      await this.subscriber.unsubscribe(channel)
      if ((this.demandCount.get(demandKey) ?? 0) <= 0) {
        this.subscriptionStateByDemandKey.set(demandKey, 'idle')
      } else {
        this.subscriptionStateByDemandKey.set(demandKey, 'subscribed')
      }
    } catch (error) {
      captureSseException(error, {
        component: 'sse-redis-subscriptions',
        tags: {
          operation: 'unsubscribe_channel',
          error_type: 'unsubscribe_failed',
          event_type: eventType,
        },
        contexts: {
          sse_redis: {
            eventType,
            routingKey,
            channel,
            demandedSubscriptions: this.demandCount.size,
            subscriptionState: this.subscriptionStateByDemandKey.get(demandKey) ?? 'idle',
          },
        },
        fingerprint: ['sse', 'redis_subscriptions', 'unsubscribe_failed'],
      })
      logger.error({ error, eventType, routingKey }, '[SSE] Failed unsubscribing from channel')
      if ((this.demandCount.get(demandKey) ?? 0) > 0) {
        this.subscriptionStateByDemandKey.set(demandKey, 'subscribed')
      } else {
        this.subscriptionStateByDemandKey.set(demandKey, 'idle')
      }
    }
  }

  private async runSerialized(demandKey: DemandKey, operation: () => Promise<void>) {
    const previous = this.subscriptionOpByDemandKey.get(demandKey) ?? Promise.resolve()
    const { eventType, routingKey } = parseDemandKey(demandKey)

    const current = previous
      .then(operation)
      .catch((error) => {
        logger.error({ error, eventType, routingKey }, '[SSE] Subscription operation failed')
      })
      .finally(() => {
        if (this.subscriptionOpByDemandKey.get(demandKey) === current) {
          this.subscriptionOpByDemandKey.delete(demandKey)
        }
      })

    this.subscriptionOpByDemandKey.set(demandKey, current)
    await current
  }
}
