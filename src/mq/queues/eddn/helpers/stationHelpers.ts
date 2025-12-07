import { eq } from 'drizzle-orm'
import type {
  EDDNJournalLocationMessage,
  EDDNJournalDockedMessage,
  ShortFactionInfo,
} from '../../../../eddn/types.js'
import { Factions, Stations } from '../../../../db/schema.js'
import { StationsInsertSchema } from '../schemas.js'
import {
  EXCLUDED_STATION_GOVERNMENTS,
  mapAllegiance,
  mapGovernment,
  mapEconomy,
  mapStationType,
} from '../constants.js'
import logger from '../../../../utils/logger.js'
import type { Transaction } from './systemHelpers.js'

/**
 * Checks if a station should be excluded based on its government type
 */
const isExcludedStation = (stationGovernment?: string) =>
  EXCLUDED_STATION_GOVERNMENTS.has(stationGovernment?.toLowerCase() ?? '')

/**
 * Finds the controlling faction ID for a station
 */
const findControllingFactionId = async (tx: Transaction, factionName: string) => {
  const factions = await tx
    .select({ id: Factions.id })
    .from(Factions)
    .where(eq(Factions.name, factionName))
    .limit(1)
    .execute()
    .catch((error) => {
      logger.error(error, `Failed to find controlling faction for station: ${factionName}`)
      return null
    })

  return factions?.[0]?.id ?? null
}

/**
 * Builds station data from a Location message (when docked)
 */
const buildStationDataFromLocation = (
  message: EDDNJournalLocationMessage & { StationName: string; MarketID: number },
  systemId: string,
  controllingFactionId: string
): typeof Stations.$inferInsert => ({
  name: message.StationName,
  marketId: message.MarketID,
  stationType: mapStationType(message.StationType),
  systemId,
  controllingFactionId,
  distanceFromStar: message.DistFromStarLS!,
  allegiance: mapAllegiance(message.StationAllegiance),
  government: mapGovernment(message.StationGovernment),
  economy: mapEconomy(message.StationEconomy),
  economies: message.StationEconomies?.map((economy) => ({
    name: mapEconomy(economy.Name),
    proportion: economy.Proportion,
  })),
  services: message.StationServices?.map((service) => service.toLowerCase()),
})

/**
 * Builds station data from a Docked message
 */
const buildStationDataFromDocked = (
  message: EDDNJournalDockedMessage,
  systemId: string,
  controllingFactionId: string
): typeof Stations.$inferInsert => ({
  name: message.StationName,
  marketId: message.MarketID,
  stationType: mapStationType(message.StationType),
  systemId,
  controllingFactionId,
  distanceFromStar: message.DistFromStarLS,
  allegiance: mapAllegiance(message.StationAllegiance),
  government: mapGovernment(message.StationGovernment),
  economy: mapEconomy(message.StationEconomy),
  economies: message.StationEconomies?.map((economy) => ({
    name: mapEconomy(economy.Name),
    proportion: economy.Proportion,
  })),
  services: message.StationServices?.map((service) => service.toLowerCase()),
  landingPadsSmall: message.LandingPads.Small,
  landingPadsMedium: message.LandingPads.Medium,
  landingPadsLarge: message.LandingPads.Large,
})

/**
 * Checks if a Location message has all required station data
 */
const hasRequiredStationData = (
  message: EDDNJournalLocationMessage
): message is EDDNJournalLocationMessage & {
  StationName: string
  MarketID: number
  StationFaction: ShortFactionInfo
} =>
  message.Docked &&
  !!message.StationName &&
  !!message.MarketID &&
  !!message.StationFaction &&
  message.DistFromStarLS !== undefined

/**
 * Upserts a station from a Location event (when docked)
 */
export const upsertStationFromLocation = async (
  tx: Transaction,
  message: EDDNJournalLocationMessage,
  systemId: string
) => {
  if (!hasRequiredStationData(message)) {
    return
  }

  if (isExcludedStation(message.StationGovernment)) {
    return
  }

  const controllingFactionId = await findControllingFactionId(tx, message.StationFaction.Name)

  if (!controllingFactionId) {
    logger.warn(`Could not find controlling faction for station: ${message.StationFaction.Name}`)
    return
  }

  const stationData = buildStationDataFromLocation(message, systemId, controllingFactionId)
  const validatedStationData = StationsInsertSchema.parse(stationData)

  await tx
    .insert(Stations)
    .values(validatedStationData)
    .onConflictDoUpdate({
      target: Stations.marketId,
      set: {
        ...validatedStationData,
        updatedAt: new Date(),
      },
    })
}

/**
 * Upserts a station from a Docked event
 */
export const upsertStationFromDocked = async (
  tx: Transaction,
  message: EDDNJournalDockedMessage,
  systemId: string
) => {
  if (isExcludedStation(message.StationGovernment)) {
    return
  }

  const controllingFactionId = await findControllingFactionId(tx, message.StationFaction.Name)

  if (!controllingFactionId) {
    // TODO: Fetch faction from internet
    throw new Error(
      `Failed to find controlling faction after upsert: ${message.StationFaction.Name}`
    )
  }

  const stationData = buildStationDataFromDocked(message, systemId, controllingFactionId)
  const validatedStationData = StationsInsertSchema.parse(stationData)

  await tx
    .insert(Stations)
    .values(validatedStationData)
    .onConflictDoUpdate({
      target: Stations.marketId,
      set: {
        ...validatedStationData,
        updatedAt: new Date(),
      },
    })
}
