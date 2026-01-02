import type {
  EDDNJournalLocationMessage,
  EDDNJournalDockedMessage,
  ShortFactionInfo,
} from '../../../../eddn/types.js'
import { Stations } from '../../../../db/schema.js'
import { StationsInsertSchema } from '../schemas.js'
import {
  EXCLUDED_STATION_GOVERNMENTS,
  mapAllegiance,
  mapGovernment,
  mapEconomy,
  mapStationType,
} from '../constants.js'
import type { Transaction } from './systemHelpers.js'
import { upsertFactions } from './factionHelpers.js'

/**
 * Checks if a station should be excluded based on its government type
 */
const isExcludedStation = (stationGovernment?: string) =>
  EXCLUDED_STATION_GOVERNMENTS.has(stationGovernment?.toLowerCase() ?? '')

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
  distanceFromStar: message.DistFromStarLS!, // Validated in hasRequiredStationData and later using zod
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
  !!message.StationGovernment &&
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

  const [controllingFaction] = await upsertFactions(tx, [
    {
      Name: message.StationFaction.Name,
      Government: message.StationGovernment ?? 'Unknown',
      Allegiance: message.StationAllegiance ?? 'Independent',
    },
  ])

  const stationData = buildStationDataFromLocation(message, systemId, controllingFaction.id)
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

  const [controllingFaction] = await upsertFactions(tx, [
    {
      Name: message.StationFaction.Name,
      Government: message.StationGovernment,
      Allegiance: message.StationAllegiance ?? 'Independent',
    },
  ])

  const stationData = buildStationDataFromDocked(message, systemId, controllingFaction.id)
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
