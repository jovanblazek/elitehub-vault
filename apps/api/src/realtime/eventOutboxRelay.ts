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
  createdAt: Date | string
}

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0]
type PublishTargets = Exclude<ReturnType<typeof buildPublishTargetsForOutboxRow>, null>
type DiscardRowResult = {
  status: 'discard'
  reason: string
  shouldLog?: boolean
  logContext?: Record<string, unknown>
}
type RowHandlingResult = { status: 'publish'; targets: PublishTargets } | DiscardRowResult

class EventOutboxRelay {
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
    const rows = await this.fetchBatch(tx)

    if (rows.rows.length === 0) {
      return 0
    }

    for (const row of rows.rows) {
      await this.processRow(tx, row)
    }

    logger.debug({ processedCount: rows.rows.length }, '[EventOutboxRelay] Published batch')
    return rows.rows.length
  }

  private fetchBatch(tx: Transaction) {
    return tx.execute<OutboxRow>(sql`
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
  }

  private async processRow(tx: Transaction, row: OutboxRow) {
    const result = await this.prepareRowForPublishing(tx, row)

    if (result.status === 'discard') {
      if (result.shouldLog !== false) {
        logger.error(
          {
            eventType: row.eventType,
            rowId: row.id,
            ...result.logContext,
          },
          result.reason
        )
      }

      await this.deleteOutboxRow(tx, row.id)
      return
    }

    await this.publishTargets(result.targets)
    await this.deleteOutboxRow(tx, row.id)
  }

  private async prepareRowForPublishing(
    tx: Transaction,
    row: OutboxRow
  ): Promise<RowHandlingResult> {
    const powerIdsResult = await this.resolvePowerIds(tx, row)
    if (powerIdsResult.status === 'discard') {
      return powerIdsResult
    }

    const targets = buildPublishTargetsForOutboxRow({
      eventType: row.eventType,
      outboxPayload: row.payload,
      createdAt: row.createdAt,
      powerIds: powerIdsResult.powerIds,
    })

    if (targets === null) {
      return {
        status: 'discard',
        reason: '[EventOutboxRelay] Unknown event type in outbox',
      }
    }

    if (targets.length === 0) {
      return {
        status: 'discard',
        reason: '[EventOutboxRelay] Invalid payload or no publish targets built',
      }
    }

    return {
      status: 'publish',
      targets,
    }
  }

  private async resolvePowerIds(
    tx: Transaction,
    row: OutboxRow
  ): Promise<{ status: 'ok'; powerIds?: string[] } | DiscardRowResult> {
    if (row.eventType !== SYSTEM_POWERPLAY_UPDATED_EVENT) {
      return { status: 'ok' }
    }

    const powerplayPayload = parseSystemPowerplayUpdatedOutboxPayload(row.payload)
    if (!powerplayPayload) {
      return {
        status: 'discard',
        reason: '[EventOutboxRelay] Invalid powerplay payload',
      }
    }

    const powerRows = await tx
      .select({ powerId: SystemPowerplayPowers.powerId })
      .from(SystemPowerplayPowers)
      .where(eq(SystemPowerplayPowers.systemId, powerplayPayload.systemId))

    if (powerRows.length === 0) {
      return {
        status: 'discard',
        reason: '[EventOutboxRelay] Skipping powerplay outbox row with no mapped powers',
        shouldLog: false,
      }
    }

    return {
      status: 'ok',
      powerIds: powerRows.map((powerRow) => powerRow.powerId),
    }
  }

  private async publishTargets(targets: PublishTargets) {
    for (const target of targets) {
      await Redis.publish(target.channel, JSON.stringify(target.payload))
    }
  }

  private deleteOutboxRow(tx: Transaction, rowId: string) {
    return tx.delete(EventOutbox).where(eq(EventOutbox.id, rowId))
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

export const eventOutboxRelay = new EventOutboxRelay()
