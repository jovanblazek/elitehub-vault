// oxlint-disable no-await-in-loop
import { eq, sql } from 'drizzle-orm'
import { db } from '../db/db.js'
import { EventOutbox, SystemPowerplayPowers } from '../db/schema.js'
import { Redis } from '../utils/redis.js'
import logger from '../utils/logger.js'
import { parseSystemPowerplayUpdatedOutboxPayload } from './eventPayloads.js'
import {
  SYSTEM_POWERPLAY_UPDATED_EVENT,
} from './systemPowerplayUpdated.js'
import { buildSystemPowerplayPublishTargets } from './systemPowerplayFanout.js'

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
  private hadRecentError = false

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
        if (this.hadRecentError) {
          logger.info('[EventOutboxRelay] Relay resumed after error')
          this.hadRecentError = false
        }
        if (processedCount === 0) {
          await this.sleep(this.idleDelayMs)
        }
      } catch (error) {
        this.hadRecentError = true
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
      if (row.eventType !== SYSTEM_POWERPLAY_UPDATED_EVENT) {
        logger.error({ eventType: row.eventType }, '[EventOutboxRelay] Unknown event type in outbox')
        await tx.delete(EventOutbox).where(eq(EventOutbox.id, row.id))
        continue
      }

      const validatedPayload = parseSystemPowerplayUpdatedOutboxPayload(row.payload)
      if (!validatedPayload) {
        logger.error(
          { eventType: row.eventType, rowId: row.id },
          '[EventOutboxRelay] Invalid payload'
        )
        await tx.delete(EventOutbox).where(eq(EventOutbox.id, row.id))
        continue
      }

      const systemId = validatedPayload.systemId

      const powerRows = await tx
        .select({ powerId: SystemPowerplayPowers.powerId })
        .from(SystemPowerplayPowers)
        .where(eq(SystemPowerplayPowers.systemId, systemId))

      if (powerRows.length === 0) {
        await tx.delete(EventOutbox).where(eq(EventOutbox.id, row.id))
        continue
      }

      const targets = buildSystemPowerplayPublishTargets({
        outboxPayload: validatedPayload,
        createdAt: row.createdAt,
        powerIds: powerRows.map((powerRow) => powerRow.powerId),
      })

      if (targets.length === 0) {
        logger.error(
          { eventType: row.eventType, rowId: row.id },
          '[EventOutboxRelay] Failed to build power scoped payloads'
        )
        await tx.delete(EventOutbox).where(eq(EventOutbox.id, row.id))
        continue
      }

      for (const target of targets) {
        await Redis.publish(target.channel, JSON.stringify(target.payload))
      }

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
