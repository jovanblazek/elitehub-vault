// oxlint-disable no-await-in-loop
import { eq, sql } from 'drizzle-orm'
import { db } from '../db/db.js'
import { EventOutbox } from '../db/schema.js'
import { Redis } from '../utils/redis.js'
import logger from '../utils/logger.js'
import { getRealtimeChannelForEventType } from './eventChannels.js'
import { buildPublishedRealtimePayload } from './eventPayloads.js'

type OutboxRow = {
  id: string
  eventType: string
  payload: unknown
  createdAt: Date
}

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

export class EventOutboxRelay {
  private isRunning = false
  private shouldStop = false
  private loopPromise: Promise<void> | null = null
  private readonly batchSize = 100
  private readonly idleDelayMs = 250
  private readonly errorDelayMs = 1000

  start() {
    if (this.isRunning) {
      return
    }

    this.isRunning = true
    this.shouldStop = false
    this.loopPromise = this.loop()
    logger.info('[EventOutboxRelay] Started')
  }

  async stop() {
    if (!this.isRunning) {
      return
    }

    this.shouldStop = true
    await this.loopPromise
    this.isRunning = false
    logger.info('[EventOutboxRelay] Stopped')
  }

  private async loop() {
    while (!this.shouldStop) {
      try {
        const processedCount = await db.transaction(async (tx) => this.processBatch(tx))
        if (processedCount === 0) {
          await this.sleep(this.idleDelayMs)
        }
      } catch (error) {
        logger.error(error, '[EventOutboxRelay] Failed processing outbox batch')
        await this.sleep(this.errorDelayMs)
      }
    }
  }

  private async processBatch(tx: Transaction): Promise<number> {
    const rows = await tx.execute<OutboxRow>(sql`
      select
        id,
        "eventType",
        payload,
        "createdAt"
      from "eventOutbox"
      order by "createdAt" asc
      limit ${this.batchSize}
      for update skip locked
    `)

    if (rows.rows.length === 0) {
      return 0
    }

    for (const row of rows.rows) {
      const channel = getRealtimeChannelForEventType(row.eventType)
      if (!channel) {
        logger.error({ eventType: row.eventType }, '[EventOutboxRelay] Unknown event type in outbox')
        await tx.delete(EventOutbox).where(eq(EventOutbox.id, row.id))
        continue
      }

      const payload = buildPublishedRealtimePayload(row.eventType, row.payload, row.createdAt)
      if (!payload) {
        logger.error({ eventType: row.eventType, rowId: row.id }, '[EventOutboxRelay] Invalid payload')
        await tx.delete(EventOutbox).where(eq(EventOutbox.id, row.id))
        continue
      }

      await Redis.publish(channel, JSON.stringify(payload))

      await tx.delete(EventOutbox).where(eq(EventOutbox.id, row.id))
    }

    logger.debug({ processedCount: rows.rows.length }, '[EventOutboxRelay] Published batch')
    return rows.rows.length
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

export const eventOutboxRelay = new EventOutboxRelay()
