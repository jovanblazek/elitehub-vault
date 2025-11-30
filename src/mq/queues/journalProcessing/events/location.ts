import { createInsertSchema } from 'drizzle-zod'
import { eq, and, notInArray } from 'drizzle-orm'
import type { EDDNJournalLocationMessage } from '../../../../eddn/types.js'

import {
  Systems,
  Factions,
  SystemFactions,
  FactionStates,
  FactionConflicts,
  Stations,
  PowerplayPowers,
  SystemPowerplayPowers,
  PowerplayConflicts,
  FactionConflictType,
  FactionConflictStatus,
  FactionState,
  Allegiance,
} from '../../../../db/schema.js'
import { db } from '../../../../db/db.js'
import {
  AllegianceMap,
  EconomyMap,
  FactionGovernmentMap,
  FactionHappinessMap,
  FactionStateMap,
  PowerplayStateMap,
  StationTypeMap,
  SystemSecurityMap,
  ValidPowerplayPowers,
} from '../constants.js'
import logger from '../../../../utils/logger.js'

const SystemsInsertSchema = createInsertSchema(Systems)
const FactionsInsertSchema = createInsertSchema(Factions)
const FactionStatesInsertSchema = createInsertSchema(FactionStates)
const FactionConflictsInsertSchema = createInsertSchema(FactionConflicts)
const PowerplayConflictsInsertSchema = createInsertSchema(PowerplayConflicts)
const StationsInsertSchema = createInsertSchema(Stations)

const EXCLUDED_STATION_GOVERNMENTS = new Set([
  '$government_megaconstruction;',
  '$government_carrier;',
])

export const processLocationEvent = async (message: EDDNJournalLocationMessage) => {
  db.transaction(async (tx) => {
    // upsert powers into powerplayPowers table
    const powerplayPowersData = [...(message.Powers ?? []), message.ControllingPower].filter(
      (power) => power && ValidPowerplayPowers.has(power)
    ) as string[]

    const powerplayPowers = await tx
      .insert(PowerplayPowers)
      .values(powerplayPowersData.map((power) => ({ name: power })))
      .onConflictDoNothing()
      .returning()

    // upsert system
    const systemData = {
      name: message.StarSystem,
      systemAddress: message.SystemAddress,
      x: message.StarPos[0],
      y: message.StarPos[1],
      z: message.StarPos[2],
      population: message.Population,
      government:
        FactionGovernmentMap?.[
          message.SystemGovernment.toLowerCase() as keyof typeof FactionGovernmentMap
        ] ?? null,
      allegiance:
        AllegianceMap?.[message.SystemAllegiance?.toLowerCase() as keyof typeof AllegianceMap] ??
        Allegiance.Independent,
      economy: EconomyMap?.[message.SystemEconomy.toLowerCase() as keyof typeof EconomyMap] ?? null,
      secondEconomy:
        EconomyMap?.[message.SystemSecondEconomy.toLowerCase() as keyof typeof EconomyMap] ?? null,
      security:
        SystemSecurityMap?.[
          message.SystemSecurity.toLowerCase() as keyof typeof SystemSecurityMap
        ] ?? null,
      powerplayState:
        PowerplayStateMap?.[message.PowerplayState as keyof typeof PowerplayStateMap] ?? null,
      powerplayStateControlProgress: message.PowerplayStateControlProgress,
      powerplayStateReinforcement: message.PowerplayStateReinforcement,
      powerplayStateUndermining: message.PowerplayStateUndermining,
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

    const systemId = system.id

    // upsert system powerplay powers and cleanup
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

    // upsert powerplay conflicts and cleanup
    const powerplayConflictsData = (message.PowerplayConflictProgress ?? [])
      .map(({ Power, ConflictProgress }) => ({
        systemId,
        powerId: powerplayPowers.find((power) => power.name === Power)?.id,
        conflictProgress: ConflictProgress,
      }))
      .filter((conflict) => conflict.powerId)

    const validatedPowerplayConflictsData =
      PowerplayConflictsInsertSchema.array().parse(powerplayConflictsData)

    await tx
      .insert(PowerplayConflicts)
      .values(validatedPowerplayConflictsData)
      .onConflictDoNothing()

    await tx.delete(PowerplayConflicts).where(
      and(
        eq(PowerplayConflicts.systemId, systemId),
        notInArray(
          PowerplayConflicts.powerId,
          validatedPowerplayConflictsData.map((conflict) => conflict.powerId)
        )
      )
    )

    // upsert factions and related data like conflicts and states
    if (message.Factions) {
      // upsert factions
      const factionsData = message.Factions.map((faction) => ({
        name: faction.Name,
        government:
          FactionGovernmentMap?.[
            faction.Government.toLowerCase() as keyof typeof FactionGovernmentMap
          ] ?? null,
        allegiance:
          AllegianceMap?.[faction.Allegiance.toLowerCase() as keyof typeof AllegianceMap] ??
          Allegiance.Independent,
      }))

      const validatedFactionsData = FactionsInsertSchema.array().parse(factionsData)

      const factions = await tx
        .insert(Factions)
        .values(validatedFactionsData)
        .onConflictDoUpdate({
          target: [Factions.name],
          set: {
            ...validatedFactionsData,
            updatedAt: new Date(),
          },
        })
        .returning()

      const factionIdsByFactionName = factions.reduce(
        (acc, faction) => {
          acc[faction.name] = faction.id
          return acc
        },
        {} as Record<string, string>
      )

      // upsert system factions
      await tx
        .insert(SystemFactions)
        .values(factions.map(({ id }) => ({ systemId, factionId: id })))
        .onConflictDoNothing()

      // cleanup system factions
      await tx.delete(SystemFactions).where(
        and(
          eq(SystemFactions.systemId, systemId),
          notInArray(
            SystemFactions.factionId,
            factions.map(({ id }) => id)
          )
        )
      )

      // cleanup faction states - remove system factions that are not in the message
      await tx.delete(FactionStates).where(
        and(
          eq(FactionStates.systemId, systemId),
          notInArray(
            FactionStates.factionId,
            factions.map(({ id }) => id)
          )
        )
      )

      // upsert faction states
      const factionStatesData = message.Factions.map((faction) => ({
        factionId: factionIdsByFactionName[faction.Name],
        systemId,
        happiness:
          FactionHappinessMap?.[
            faction.Happiness.toLowerCase() as keyof typeof FactionHappinessMap
          ] ?? null,
        influence: faction.Influence,
        activeStates: (faction.ActiveStates ?? [])
          .map(
            (state) => FactionStateMap?.[state.State.toLowerCase() as keyof typeof FactionStateMap]
          )
          .filter(Boolean) as FactionState[],
        recoveringStates: (faction.RecoveringStates ?? [])
          .map(
            (state) => FactionStateMap?.[state.State.toLowerCase() as keyof typeof FactionStateMap]
          )
          .filter(Boolean) as FactionState[],
        pendingStates: (faction.PendingStates ?? [])
          .map(
            (state) => FactionStateMap?.[state.State.toLowerCase() as keyof typeof FactionStateMap]
          )
          .filter(Boolean) as FactionState[],
        activeStatesRaw: faction.ActiveStates ?? [],
        recoveringStatesRaw: faction.RecoveringStates ?? [],
        pendingStatesRaw: faction.PendingStates ?? [],
      }))

      const validatedFactionStatesData = FactionStatesInsertSchema.array().parse(factionStatesData)

      await tx
        .insert(FactionStates)
        .values(validatedFactionStatesData)
        .onConflictDoUpdate({
          target: [FactionStates.factionId, FactionStates.systemId],
          set: {
            ...validatedFactionStatesData,
            updatedAt: new Date(),
          },
        })

      // upsert faction conflicts
      const conflictsData = []

      for (const conflict of message.Conflicts ?? []) {
        // Find faction1
        const faction1 = await tx
          .select({ id: Factions.id })
          .from(Factions)
          .where(eq(Factions.name, conflict.Faction1.Name))
          .limit(1)

        // Find faction2
        const faction2 = await tx
          .select({ id: Factions.id })
          .from(Factions)
          .where(eq(Factions.name, conflict.Faction2.Name))
          .limit(1)

        if (!faction1[0] || !faction2[0]) {
          console.warn(
            `Could not find factions for conflict: ${conflict.Faction1.Name} vs ${conflict.Faction2.Name}`
          )
          continue
        }

        // Find stations by stake (if they exist)
        const factionStakeStation = conflict.Faction1.Stake
          ? await tx
              .select({ id: Stations.id })
              .from(Stations)
              .where(eq(Stations.name, conflict.Faction1.Stake))
              .limit(1)
          : null

        const opponentStakeStation = conflict.Faction2.Stake
          ? await tx
              .select({ id: Stations.id })
              .from(Stations)
              .where(eq(Stations.name, conflict.Faction2.Stake))
              .limit(1)
          : null

        conflictsData.push({
          systemId,
          factionId: faction1[0].id,
          opponentFactionId: faction2[0].id,
          type: conflict.WarType as FactionConflictType,
          status: conflict.Status as FactionConflictStatus,
          factionWonDays: conflict.Faction1.WonDays,
          opponentWonDays: conflict.Faction2.WonDays,
          factionStake: conflict.Faction1.Stake,
          factionStakeStationId: factionStakeStation?.[0]?.id ?? null,
          opponentStake: conflict.Faction2.Stake,
          opponentStakeStationId: opponentStakeStation?.[0]?.id ?? null,
        })
      }

      const validatedConflictsData = FactionConflictsInsertSchema.array().parse(conflictsData)

      const insertedConflicts = await tx
        .insert(FactionConflicts)
        .values(validatedConflictsData)
        .onConflictDoUpdate({
          target: [
            FactionConflicts.systemId,
            FactionConflicts.factionId,
            FactionConflicts.opponentFactionId,
          ],
          set: {
            ...validatedConflictsData,
            updatedAt: new Date(),
          },
        })
        .returning()

      // cleanup conflicts - remove conflicts that are not in the message
      await tx.delete(FactionConflicts).where(
        and(
          eq(FactionConflicts.systemId, systemId),
          notInArray(
            FactionConflicts.id,
            insertedConflicts.map((conflict) => conflict.id)
          )
        )
      )
    }

    // upsert station if player is docked and station data is present
    if (
      message.Docked &&
      message.StationName &&
      message.MarketID &&
      message.StationFaction &&
      message.DistFromStarLS !== undefined &&
      !EXCLUDED_STATION_GOVERNMENTS.has(message.StationGovernment?.toLowerCase() ?? '')
    ) {
      const stationFactions = await tx
        .select({ id: Factions.id })
        .from(Factions)
        .where(eq(Factions.name, message.StationFaction.Name))
        .limit(1)
        .execute()
        .catch((error) => {
          logger.error(
            error,
            `Failed to find controlling faction for station: ${message.StationFaction?.Name}`
          )
          return null
        })

      if (!stationFactions || stationFactions.length === 0) {
        logger.warn(`Could not find controlling faction for station: ${message.StationFaction.Name}`)
      } else {
        const stationData: typeof Stations.$inferInsert = {
          name: message.StationName,
          marketId: message.MarketID,
          stationType:
            StationTypeMap?.[message.StationType?.toLowerCase() as keyof typeof StationTypeMap] ??
            null,
          systemId,
          controllingFactionId: stationFactions[0].id,
          distanceFromStar: message.DistFromStarLS,
          allegiance:
            AllegianceMap?.[
              message.StationAllegiance?.toLowerCase() as keyof typeof AllegianceMap
            ] ?? Allegiance.Independent,
          government:
            FactionGovernmentMap?.[
              message.StationGovernment as keyof typeof FactionGovernmentMap
            ] ?? null,
          economy:
            EconomyMap?.[message.StationEconomy as keyof typeof EconomyMap] ?? null,
          economies: message.StationEconomies?.map((economy) => ({
            name: EconomyMap?.[economy.Name as keyof typeof EconomyMap] ?? null,
            proportion: economy.Proportion,
          })),
          services: message.StationServices?.map((service) => service.toLowerCase()),
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
      }
    }
  })
}
