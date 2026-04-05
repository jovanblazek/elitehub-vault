import { eq, and, notInArray, inArray, sql } from 'drizzle-orm'
import type {
  EDDNJournalLocationMessage,
  EDDNJournalFSDJumpMessage,
} from '../../../../eddn/types.js'
import {
  PowerplayPowers,
  SystemPowerplayPowers,
  PowerplayConflicts,
} from '../../../../db/schema.js'
import { PowerplayConflictsInsertSchema } from '../validationSchemas.js'
import { PowerplayPowersFromLowercaseMap, ValidPowerplayPowersLowercased } from '../constants.js'
import type { Transaction } from './systemHelpers.js'

type PowerplayMessage = EDDNJournalLocationMessage | EDDNJournalFSDJumpMessage

/**
 * Upserts powerplay powers and returns the inserted records
 */
export const upsertPowerplayPowers = async (tx: Transaction, message: PowerplayMessage) => {
  const incomingPowersLowercased = [...(message.Powers ?? []), message.ControllingPower]
    .map((power) => power?.toLowerCase())
    .filter((power): power is string => !!power)

  if (incomingPowersLowercased.length === 0) {
    return []
  }

  const validIncomingPowerplayPowers = incomingPowersLowercased
    .filter((power) => ValidPowerplayPowersLowercased.has(power))
    .map(
      (power) =>
        PowerplayPowersFromLowercaseMap[power as keyof typeof PowerplayPowersFromLowercaseMap]
    )

  if (incomingPowersLowercased.length !== validIncomingPowerplayPowers.length) {
    throw new Error('Invalid powerplay powers')
  }

  const powerplayPowersToInsert = validIncomingPowerplayPowers.map((power) => ({ name: power }))

  await tx.insert(PowerplayPowers).values(powerplayPowersToInsert).onConflictDoNothing()

  // Get {id, name} from powerplayPowers
  const upsertedPowerplayPowers = await tx
    .select({ id: PowerplayPowers.id, name: PowerplayPowers.name })
    .from(PowerplayPowers)
    .where(inArray(PowerplayPowers.name, validIncomingPowerplayPowers))

  return upsertedPowerplayPowers
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
  const powerplayConflictsByPowerId = new Map<string, { systemId: string; powerId: string; conflictProgress: number }>()

  for (const conflict of message.PowerplayConflictProgress ?? []) {
    const powerId = powerplayPowers.find((power) => power.name === conflict.Power)?.id

    if (!powerId) {
      continue
    }

    powerplayConflictsByPowerId.set(powerId, {
      systemId,
      powerId,
      conflictProgress: conflict.ConflictProgress,
    })
  }

  const powerplayConflictsData = [...powerplayConflictsByPowerId.values()]

  if (powerplayConflictsData.length === 0) {
    // Clean up all powerplay conflicts for this system if none exist
    await tx.delete(PowerplayConflicts).where(eq(PowerplayConflicts.systemId, systemId))
    return
  }

  const validatedPowerplayConflictsData =
    PowerplayConflictsInsertSchema.array().parse(powerplayConflictsData)

  await tx
    .insert(PowerplayConflicts)
    .values(validatedPowerplayConflictsData)
    .onConflictDoUpdate({
      target: [PowerplayConflicts.systemId, PowerplayConflicts.powerId],
      set: {
        conflictProgress: sql`excluded."conflictProgress"`,
        updatedAt: new Date(),
      },
    })

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
