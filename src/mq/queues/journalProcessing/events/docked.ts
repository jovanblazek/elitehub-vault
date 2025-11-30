import { createInsertSchema } from 'drizzle-zod'
import { EDDNJournalDockedMessage } from '../../../../eddn/types.js'
import { Allegiance, Factions, Stations, Systems } from '../../../../db/schema.js'
import { db } from '../../../../db/db.js'
import { AllegianceMap, EconomyMap, FactionGovernmentMap, StationTypeMap } from '../constants.js'
import { eq } from 'drizzle-orm'
import logger from '../../../../utils/logger.js'

const SystemsInsertSchema = createInsertSchema(Systems)
const StationsInsertSchema = createInsertSchema(Stations)

const EXCLUDED_STATION_GOVERNMENTS = new Set([
  '$government_megaconstruction;',
  '$government_carrier;',
])

export const processDockedEvent = async (message: EDDNJournalDockedMessage) => {
  db.transaction(async (tx) => {
    // Upsert system
    const systemData: typeof Systems.$inferInsert = {
      name: message.StarSystem,
      systemAddress: message.SystemAddress,
      x: message.StarPos[0],
      y: message.StarPos[1],
      z: message.StarPos[2],
    }
    const validatedSystemData = SystemsInsertSchema.parse(systemData)

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
      throw new Error(`Failed to find system after upsert: ${message.StarSystem}`)
    }

    if (EXCLUDED_STATION_GOVERNMENTS.has(message?.StationGovernment?.toLowerCase() ?? '')) {
      return
    }

    const factions = await tx
      .select({ id: Factions.id })
      .from(Factions)
      .where(eq(Factions.name, message.StationFaction.Name))
      .limit(1)
      .execute()
      .catch((error) => {
        logger.error(
          error,
          `Failed to find controlling faction after upsert: ${message.StationFaction.Name}`
        )
        return null
      })

    if (!factions || factions.length === 0) {
      // TODO: Fetch faction from internet
      throw new Error(
        `Failed to find controlling faction after upsert: ${message.StationFaction.Name}`
      )
    }

    // Upsert station
    const stationData: typeof Stations.$inferInsert = {
      name: message.StationName,
      marketId: message.MarketID,
      stationType:
        StationTypeMap?.[message.StationType.toLowerCase() as keyof typeof StationTypeMap] ?? null,
      systemId: system.id,
      controllingFactionId: factions[0].id,
      distanceFromStar: message.DistFromStarLS,
      allegiance:
        AllegianceMap?.[message.StationAllegiance?.toLowerCase() as keyof typeof AllegianceMap] ??
        Allegiance.Independent,
      government:
        FactionGovernmentMap?.[message.StationGovernment as keyof typeof FactionGovernmentMap] ??
        null,
      economy: EconomyMap?.[message.StationEconomy as keyof typeof EconomyMap] ?? null,
      economies: message.StationEconomies?.map((economy) => ({
        name: EconomyMap?.[economy.Name as keyof typeof EconomyMap] ?? null,
        proportion: economy.Proportion,
      })),
      services: message.StationServices?.map((service) => service.toLowerCase()),
      landingPadsSmall: message.LandingPads.Small,
      landingPadsMedium: message.LandingPads.Medium,
      landingPadsLarge: message.LandingPads.Large,
    }
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
  })
}
