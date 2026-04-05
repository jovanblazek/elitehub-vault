import { Systems } from '@elitehub/db'
import { eq } from 'drizzle-orm'
import type {
  EDDNJournalLocationMessage,
  EDDNJournalFSDJumpMessage,
  EDDNJournalDockedMessage,
} from '../../../../eddn/types.js'
import { db } from '../../../../db/db.js'
import { SystemsInsertSchema } from '../validationSchemas.js'
import {
  mapGovernment,
  mapAllegiance,
  mapEconomy,
  mapSecurity,
  mapPowerplayState,
} from '../constants.js'

export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

type FullSystemMessage = EDDNJournalLocationMessage | EDDNJournalFSDJumpMessage

export const buildFullSystemData = (message: FullSystemMessage) => ({
  name: message.StarSystem,
  systemAddress: message.SystemAddress,
  x: message.StarPos[0],
  y: message.StarPos[1],
  z: message.StarPos[2],
  population: message.Population,
  government: mapGovernment(message.SystemGovernment),
  allegiance: mapAllegiance(message.SystemAllegiance),
  economy: mapEconomy(message.SystemEconomy),
  secondEconomy: mapEconomy(message.SystemSecondEconomy),
  security: mapSecurity(message.SystemSecurity),
  powerplayState: mapPowerplayState(message.PowerplayState),
  powerplayStateControlProgress: message.PowerplayStateControlProgress,
  powerplayStateReinforcement: message.PowerplayStateReinforcement,
  powerplayStateUndermining: message.PowerplayStateUndermining,
})

/**
 * Builds partial system data (required properties only)
 */
export const buildPartialSystemData = (message: EDDNJournalDockedMessage) => ({
  name: message.StarSystem,
  systemAddress: message.SystemAddress,
  x: message.StarPos[0],
  y: message.StarPos[1],
  z: message.StarPos[2],
})

/**
 * Upserts a system and returns the inserted/updated system
 */
export const upsertSystem = async (
  tx: Transaction,
  data: ReturnType<typeof buildFullSystemData> | ReturnType<typeof buildPartialSystemData>
) => {
  const validatedSystemData = SystemsInsertSchema.parse(data)
  const [system] = await tx
    .insert(Systems)
    .values(validatedSystemData)
    .onConflictDoUpdate({
      target: Systems.systemAddress,
      set: {
        ...validatedSystemData,
        updatedAt: new Date(),
      },
    })
    .returning()

  if (!system) {
    throw new Error(`Failed to find system after upsert: ${data.name}`)
  }

  return system
}

/**
 * Checks if a system should be deleted based on population and government
 */
export const shouldDeleteSystem = (data: ReturnType<typeof buildFullSystemData>): boolean => {
  return data.population === 0 && (data.government === null || data.government === undefined)
}

/**
 * Deletes a system by systemAddress if it exists
 * Returns the deleted system if found, null if not found
 */
export const deleteSystem = async (
  tx: Transaction,
  systemAddress: number
): Promise<{ id: string; name: string } | null> => {
  const [deleted] = await tx
    .delete(Systems)
    .where(eq(Systems.systemAddress, systemAddress))
    .returning({ id: Systems.id, name: Systems.name })

  return deleted ?? null
}
