import { Stations } from '@elitehub/db/schema'
import { and, eq } from 'drizzle-orm'
import * as Sentry from '@sentry/node'
import type {
  EDDNJournalLocationMessage,
  EDDNJournalDockedMessage,
  ShortFactionInfo,
} from '@elitehub/eddn-contracts'
import { StationsInsertSchema } from '../validationSchemas.js'
import {
  EXCLUDED_STATION_GOVERNMENTS,
  mapAllegiance,
  mapGovernment,
  mapEconomy,
  mapStationType,
} from '../constants.js'
import type { Transaction } from './systemHelpers.js'
import { upsertFactions } from './factionHelpers.js'
import {
  findStrongholdCarriersInSystem,
  isStrongholdCarrier,
  isSystemCurrentlyStronghold,
} from './strongholdCarrierHelpers.js'
import { buildStationWritePayload, normalizeStationServices } from './stationServices.js'
import logger from '../../../../utils/logger.js'

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
  await upsertStation(tx, stationData)
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
  await upsertStation(tx, stationData)
}

const upsertStation = async (tx: Transaction, data: typeof Stations.$inferInsert) => {
  const normalizedServices = normalizeStationServices({
    rawServices: Array.isArray(data.services) ? data.services : undefined,
    sentry: Sentry,
    stationContext: {
      marketId: data.marketId ?? null,
      name: data.name,
      systemId: data.systemId,
    },
  })
  const validatedStationData = StationsInsertSchema.parse({
    ...data,
    services: normalizedServices.legacyServices ?? data.services,
    servicesV2: normalizedServices.servicesV2,
  })
  const now = new Date()

  if (isStrongholdCarrier(validatedStationData)) {
    await upsertStrongholdCarrier(tx, validatedStationData, now)
    return
  }

  await upsertRegularStation(tx, validatedStationData, now)
}

const findStationByMarketId = async (tx: Transaction, marketId: number | null) => {
  if (marketId === null) {
    return null
  }

  const [station] = await tx.select().from(Stations).where(eq(Stations.marketId, marketId)).limit(1)

  return station ?? null
}

const findStationBySystemAndName = async (tx: Transaction, systemId: string, name: string) => {
  const [station] = await tx
    .select()
    .from(Stations)
    .where(and(eq(Stations.systemId, systemId), eq(Stations.name, name)))
    .limit(1)

  return station ?? null
}

const updateStationById = async (
  tx: Transaction,
  stationId: string,
  data: typeof Stations.$inferInsert,
  updatedAt: Date
) => {
  await tx
    .update(Stations)
    .set({
      ...data,
      updatedAt,
    })
    .where(eq(Stations.id, stationId))
}

const insertStation = async (tx: Transaction, data: typeof Stations.$inferInsert) => {
  await tx.insert(Stations).values(data)
}

const deleteStationById = async (tx: Transaction, stationId: string) => {
  logger.info(`[STATION HELPER] Deleting station ${stationId}`)
  await tx.delete(Stations).where(eq(Stations.id, stationId))
}

const upsertRegularStation = async (
  tx: Transaction,
  data: typeof Stations.$inferInsert,
  updatedAt: Date
) => {
  const stationByMarketId = await findStationByMarketId(tx, data.marketId ?? null)
  const stationBySystemAndName = await findStationBySystemAndName(tx, data.systemId, data.name)

  if (!stationByMarketId && !stationBySystemAndName) {
    await insertStation(tx, data)
    return
  }

  if (
    stationByMarketId &&
    stationBySystemAndName &&
    stationByMarketId.id !== stationBySystemAndName.id
  ) {
    const writePayload = buildStationWritePayload({
      incomingLegacyServices: data.services as string[] | undefined,
      incomingServicesV2: data.servicesV2,
      persistedServices: stationBySystemAndName.services as unknown[] | undefined,
      persistedServicesV2: stationBySystemAndName.servicesV2,
      sentry: Sentry,
      stationContext: {
        marketId: data.marketId ?? null,
        name: data.name,
        systemId: data.systemId,
      },
    })
    logger.info(
      `[STATION HELPER] Deleting station ${stationByMarketId.name}:${stationByMarketId.id} for system ${data.systemId}. Updating ${stationBySystemAndName.name}:${stationBySystemAndName.id} instead.`
    )
    await deleteStationById(tx, stationByMarketId.id)
    await updateStationById(
      tx,
      stationBySystemAndName.id,
      {
        ...data,
        ...writePayload,
      },
      updatedAt
    )
    return
  }

  const survivor = stationByMarketId ?? stationBySystemAndName

  if (!survivor) {
    await insertStation(tx, data)
    return
  }

  const writePayload = buildStationWritePayload({
    incomingLegacyServices: data.services as string[] | undefined,
    incomingServicesV2: data.servicesV2,
    persistedServices: survivor.services as unknown[] | undefined,
    persistedServicesV2: survivor.servicesV2,
    sentry: Sentry,
    stationContext: {
      marketId: data.marketId ?? null,
      name: data.name,
      systemId: data.systemId,
    },
  })

  await updateStationById(
    tx,
    survivor.id,
    {
      ...data,
      ...writePayload,
    },
    updatedAt
  )
}

const upsertStrongholdCarrier = async (
  tx: Transaction,
  data: typeof Stations.$inferInsert,
  updatedAt: Date
) => {
  const isSystemStronghold = await isSystemCurrentlyStronghold(tx, data.systemId)
  if (!isSystemStronghold) {
    return
  }

  const carrierRows = await findStrongholdCarriersInSystem(tx, data.systemId)
  const marketIdStation = await findStationByMarketId(tx, data.marketId ?? null)

  const [survivor, ...duplicates] = carrierRows

  if (duplicates.length > 0) {
    logger.info(
      `[STATION HELPER] Deleting ${duplicates.length} duplicate stronghold carriers for system ${data.systemId}.`
    )
    await Promise.all(duplicates.map((duplicate) => deleteStationById(tx, duplicate.id)))
  }

  if (marketIdStation && marketIdStation.id !== survivor?.id) {
    logger.info(
      `[STATION HELPER] Deleting station ${marketIdStation.name}:${marketIdStation.id} for system ${data.systemId}. Market ID was reused.`
    )
    await deleteStationById(tx, marketIdStation.id)
  }

  if (!survivor) {
    await insertStation(tx, data)
    return
  }

  await updateStationById(tx, survivor.id, data, updatedAt)
}
