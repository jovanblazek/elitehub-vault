import { eq, and, notInArray } from 'drizzle-orm'
import type {
  EDDNJournalLocationMessage,
  EDDNJournalFSDJumpMessage,
} from '../../../../eddn/types.js'
import {
  PowerplayPowers,
  SystemPowerplayPowers,
  PowerplayConflicts,
} from '../../../../db/schema.js'
import { PowerplayConflictsInsertSchema } from '../schemas.js'
import { ValidPowerplayPowers } from '../constants.js'
import type { Transaction } from './systemHelpers.js'

type PowerplayMessage = EDDNJournalLocationMessage | EDDNJournalFSDJumpMessage

/**
 * Upserts powerplay powers and returns the inserted records
 */
export const upsertPowerplayPowers = async (tx: Transaction, message: PowerplayMessage) => {
  const powerplayPowersData = [...(message.Powers ?? []), message.ControllingPower].filter(
    (power) => power && ValidPowerplayPowers.has(power)
  ) as string[]

  if (powerplayPowersData.length === 0) {
    return []
  }

  const powerplayPowers = await tx
    .insert(PowerplayPowers)
    .values(powerplayPowersData.map((power) => ({ name: power })))
    .onConflictDoNothing()
    .returning()

  return powerplayPowers
}

/**
 * Upserts system powerplay powers associations and cleans up stale ones
 */
export const upsertSystemPowerplayPowers = async (
  tx: Transaction,
  systemId: string,
  powerplayPowers: { id: string; name: string }[]
) => {
  if (powerplayPowers.length === 0) {
    // Clean up all system powerplay powers if none exist
    await tx.delete(SystemPowerplayPowers).where(eq(SystemPowerplayPowers.systemId, systemId))
    return
  }

  await tx
    .insert(SystemPowerplayPowers)
    .values(powerplayPowers.map((power) => ({ systemId, powerId: power.id })))
    .onConflictDoNothing()

  await tx.delete(SystemPowerplayPowers).where(
    and(
      eq(SystemPowerplayPowers.systemId, systemId),
      notInArray(
        SystemPowerplayPowers.powerId,
        powerplayPowers.map((power) => power.id)
      )
    )
  )
}

/**
 * Upserts powerplay conflicts and cleans up stale ones
 */
export const upsertPowerplayConflicts = async (
  tx: Transaction,
  systemId: string,
  message: PowerplayMessage,
  powerplayPowers: { id: string; name: string }[]
) => {
  const powerplayConflictsData = (message.PowerplayConflictProgress ?? [])
    .map(({ Power, ConflictProgress }) => ({
      systemId,
      powerId: powerplayPowers.find((power) => power.name === Power)?.id,
      conflictProgress: ConflictProgress,
    }))
    .filter((conflict) => conflict.powerId)

  if (powerplayConflictsData.length === 0) {
    // Clean up all powerplay conflicts for this system if none exist
    await tx.delete(PowerplayConflicts).where(eq(PowerplayConflicts.systemId, systemId))
    return
  }

  const validatedPowerplayConflictsData =
    PowerplayConflictsInsertSchema.array().parse(powerplayConflictsData)

  await tx.insert(PowerplayConflicts).values(validatedPowerplayConflictsData).onConflictDoNothing()

  await tx.delete(PowerplayConflicts).where(
    and(
      eq(PowerplayConflicts.systemId, systemId),
      notInArray(
        PowerplayConflicts.powerId,
        validatedPowerplayConflictsData.map((conflict) => conflict.powerId)
      )
    )
  )
}

/**
 * Processes all powerplay-related data for a system
 */
export const processPowerplayData = async (
  tx: Transaction,
  message: PowerplayMessage,
  systemId: string
) => {
  const powerplayPowers = await upsertPowerplayPowers(tx, message)
  await upsertSystemPowerplayPowers(tx, systemId, powerplayPowers)
  await upsertPowerplayConflicts(tx, systemId, message, powerplayPowers)
}

