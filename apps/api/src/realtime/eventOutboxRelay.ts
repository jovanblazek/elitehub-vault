// oxlint-disable no-await-in-loop
import { eq, sql } from 'drizzle-orm'
import { EventOutbox, SystemPowerplayPowers } from '@elitehub/db'
import {
  parseSystemPowerplayUpdatedOutboxPayload,
  SYSTEM_POWERPLAY_UPDATED_EVENT,
} from '@elitehub/queue-contracts'
import { db } from '../db/db.js'
import logger from '../utils/logger.js'
import { Redis } from '../utils/redis.js'
import { buildPublishTargetsForOutboxRow } from './eventPublishTargets.js'

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
      let powerIds: string[] | undefined
      if (row.eventType === SYSTEM_POWERPLAY_UPDATED_EVENT) {
        const powerplayPayload = parseSystemPowerplayUpdatedOutboxPayload(row.payload)
        if (!powerplayPayload) {
          logger.error(
            { eventType: row.eventType, rowId: row.id },
            '[EventOutboxRelay] Invalid powerplay payload'
          )
          await tx.delete(EventOutbox).where(eq(EventOutbox.id, row.id))
          continue
        }

        const powerRows = await tx
          .select({ powerId: SystemPowerplayPowers.powerId })
          .from(SystemPowerplayPowers)
          .where(eq(SystemPowerplayPowers.systemId, powerplayPayload.systemId))

        if (powerRows.length === 0) {
          await tx.delete(EventOutbox).where(eq(EventOutbox.id, row.id))
          continue
        }

        powerIds = powerRows.map((powerRow) => powerRow.powerId)
      }

      const targets = buildPublishTargetsForOutboxRow({
        eventType: row.eventType,
        outboxPayload: row.payload,
        createdAt: row.createdAt,
        powerIds,
      })

      if (targets === null) {
        logger.error(
          { eventType: row.eventType },
          '[EventOutboxRelay] Unknown event type in outbox'
        )
        await tx.delete(EventOutbox).where(eq(EventOutbox.id, row.id))
        continue
      }

      if (targets.length === 0) {
        logger.error(
          { eventType: row.eventType, rowId: row.id },
          '[EventOutboxRelay] Invalid payload or no publish targets built'
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
