import { Systems } from '@elitehub/db'
import type {
  EDDNJournalLocationMessage,
  EDDNJournalFSDJumpMessage,
  EDDNJournalDockedMessage,
} from '@elitehub/eddn-contracts'
import { db } from '../../../../db/db.js'
import { SystemsInsertSchema } from '../validationSchemas.js'
import {
  EXCLUDED_STATION_GOVERNMENTS,
  mapGovernment,
  mapAllegiance,
  mapEconomy,
  mapSecurity,
  mapPowerplayState,
} from '../constants.js'

export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

type FullSystemMessage = EDDNJournalLocationMessage | EDDNJournalFSDJumpMessage

const hasExcludedStationGovernment = (stationGovernment?: string) =>
  EXCLUDED_STATION_GOVERNMENTS.has(stationGovernment?.toLowerCase() ?? '')

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
 * Only keep systems that have at least one meaningful signal in the incoming event.
 */
export const shouldUpsertSystem = (
  message: FullSystemMessage,
  data: ReturnType<typeof buildFullSystemData>
): boolean => {
  const hasPopulation = data.population > 0
  const hasGovernment = data.government !== null && data.government !== undefined
  const hasFactions = (message.Factions?.length ?? 0) > 0
  const hasStation =
    message.event === 'Location' &&
    !hasExcludedStationGovernment(message.StationGovernment) &&
    (message.Docked === true ||
      !!message.StationName ||
      !!message.MarketID ||
      !!message.StationType)

  return hasPopulation || hasGovernment || hasFactions || hasStation
}

export const shouldUpsertSystemFromDocked = (message: EDDNJournalDockedMessage): boolean => {
  return !hasExcludedStationGovernment(message.StationGovernment)
}
