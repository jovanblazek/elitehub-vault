import type { Redis } from 'ioredis'
import logger from '../../utils/logger.js'
import type { SystemPowerplayUpdatedPayload } from '../systemPowerplayUpdated.js'
import {
  findRealtimeEventByChannel,
  getRealtimeEventSpec,
  type RealtimeEventType,
} from './eventRegistry.js'

type SubscriptionState = 'idle' | 'subscribing' | 'subscribed' | 'unsubscribing'

export type RoutedRealtimeEvent = {
  eventType: RealtimeEventType
  powerId: string
  payload: SystemPowerplayUpdatedPayload
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

export class RedisSubscriptionManager {
  private readonly subscriber: RedisSubscriberLike
  private readonly powerDemandCount = new Map<string, number>()
  private readonly subscriptionStateByPower = new Map<string, SubscriptionState>()
  private readonly subscriptionOpByPower = new Map<string, Promise<void>>()
  private isStarted = false

  constructor(
    subscriber: RedisSubscriberLike,
    private readonly onEvent: (event: RoutedRealtimeEvent) => void
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

    this.powerDemandCount.clear()
    this.subscriptionStateByPower.clear()
    this.subscriptionOpByPower.clear()

    await this.subscriber.quit()
  }

  async incrementPowerDemand(powerId: string) {
    await this.runSerialized(powerId, async () => {
      const current = this.powerDemandCount.get(powerId) ?? 0
      const next = current + 1
      this.powerDemandCount.set(powerId, next)
      if (current === 0) {
        await this.subscribePowerIfNeeded(powerId)
      }
    })
  }

  async decrementPowerDemand(powerId: string) {
    await this.runSerialized(powerId, async () => {
      const current = this.powerDemandCount.get(powerId) ?? 0
      if (current <= 0) {
        return
      }

      const next = current - 1
      if (next === 0) {
        this.powerDemandCount.delete(powerId)
        await this.unsubscribePowerIfNeeded(powerId)
      } else {
        this.powerDemandCount.set(powerId, next)
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
      powerId: match.powerId,
      payload,
    })
  }

  private readonly onReady = () => {
    for (const powerId of this.powerDemandCount.keys()) {
      this.subscriptionStateByPower.set(powerId, 'idle')
    }

    void this.reconcileAllSubscriptions()
  }

  private readonly onError = (error: unknown) => {
    logger.error(error, '[SSE] Redis subscriber error')
  }

  private readonly onClose = () => {
    logger.warn('[SSE] Redis subscriber connection closed')
    for (const [powerId, state] of this.subscriptionStateByPower.entries()) {
      if (state === 'subscribed' || state === 'subscribing') {
        this.subscriptionStateByPower.set(powerId, 'idle')
      }
    }
  }

  private async reconcileAllSubscriptions() {
    const powers = Array.from(this.powerDemandCount.keys())
    await Promise.all(
      powers.map((powerId) =>
        this.runSerialized(powerId, async () => {
          await this.subscribePowerIfNeeded(powerId)
        })
      )
    )
  }

  private async subscribePowerIfNeeded(powerId: string) {
    const currentDemand = this.powerDemandCount.get(powerId) ?? 0
    if (currentDemand <= 0) {
      return
    }

    const state = this.subscriptionStateByPower.get(powerId)
    if (state === 'subscribed' || state === 'subscribing') {
      return
    }

    const spec = getRealtimeEventSpec('systemPowerplayUpdated')
    if (!spec) {
      return
    }

    this.subscriptionStateByPower.set(powerId, 'subscribing')
    const channel = spec.getChannel(powerId)

    try {
      await this.subscriber.subscribe(channel)
      if ((this.powerDemandCount.get(powerId) ?? 0) > 0) {
        this.subscriptionStateByPower.set(powerId, 'subscribed')
      } else {
        this.subscriptionStateByPower.set(powerId, 'subscribed')
        await this.unsubscribePowerIfNeeded(powerId)
      }
    } catch (error) {
      this.subscriptionStateByPower.set(powerId, 'idle')
      logger.error({ error, powerId }, '[SSE] Failed subscribing to power channel')
    }
  }

  private async unsubscribePowerIfNeeded(powerId: string) {
    const currentDemand = this.powerDemandCount.get(powerId) ?? 0
    if (currentDemand > 0) {
      return
    }

    const state = this.subscriptionStateByPower.get(powerId)
    if (!state || state === 'idle' || state === 'unsubscribing') {
      return
    }

    const spec = getRealtimeEventSpec('systemPowerplayUpdated')
    if (!spec) {
      return
    }

    const channel = spec.getChannel(powerId)
    this.subscriptionStateByPower.set(powerId, 'unsubscribing')

    try {
      await this.subscriber.unsubscribe(channel)
      if ((this.powerDemandCount.get(powerId) ?? 0) <= 0) {
        this.subscriptionStateByPower.set(powerId, 'idle')
      } else {
        this.subscriptionStateByPower.set(powerId, 'subscribed')
      }
    } catch (error) {
      logger.error({ error, powerId }, '[SSE] Failed unsubscribing from power channel')
      if ((this.powerDemandCount.get(powerId) ?? 0) > 0) {
        this.subscriptionStateByPower.set(powerId, 'subscribed')
      } else {
        this.subscriptionStateByPower.set(powerId, 'idle')
      }
    }
  }

  private async runSerialized(powerId: string, operation: () => Promise<void>) {
    const previous = this.subscriptionOpByPower.get(powerId) ?? Promise.resolve()

    const current = previous
      .then(operation)
      .catch((error) => {
        logger.error({ error, powerId }, '[SSE] Power subscription operation failed')
      })
      .finally(() => {
        if (this.subscriptionOpByPower.get(powerId) === current) {
          this.subscriptionOpByPower.delete(powerId)
        }
      })

    this.subscriptionOpByPower.set(powerId, current)
    await current
  }
}
