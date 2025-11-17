import { createInsertSchema, createUpdateSchema } from 'drizzle-zod'
import { eq, and, notInArray } from 'drizzle-orm'
import type { EDDNJournalFSDJumpMessage } from '../../../../eddn/types.js'

import {
  Systems,
  Factions,
  SystemFactions,
  PowerplayState,
  PowerplayPowers,
  SystemPowerplayPowers,
  PowerplayConflicts,
} from '../../../../db/schema.js'
import { db } from '../../../../db/db.js'
import {
  AllegianceMap,
  EconomyMap,
  FactionGovernmentMap,
  PowerplayStateMap,
  SystemSecurityMap,
  ValidPowerplayPowers,
} from '../constants.js'

const SystemsInsertSchema = createInsertSchema(Systems)
const FactionsInsertSchema = createInsertSchema(Factions)
const SystemFactionsInsertSchema = createInsertSchema(SystemFactions)
const PowerplayConflictsInsertSchema = createInsertSchema(PowerplayConflicts)

// TODO: Add transactions when done with implementing all the logic
export const processFSDJumpEvent = async (message: EDDNJournalFSDJumpMessage) => {
  console.log('processFSDJumpEvent', message)

  // upsert powers into powerplayPowers table
  const powerplayPowersData = [...(message.Powers ?? []), message.ControllingPower].filter(
    (power) => power && ValidPowerplayPowers.has(power)
  ) as string[]

  const powerplayPowers = await db
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
      FactionGovernmentMap?.[message.SystemGovernment as keyof typeof FactionGovernmentMap] ?? null,
    allegiance: AllegianceMap?.[message.SystemAllegiance as keyof typeof AllegianceMap] ?? null,
    economy: EconomyMap?.[message.SystemEconomy as keyof typeof EconomyMap] ?? null,
    secondEconomy: EconomyMap?.[message.SystemSecondEconomy as keyof typeof EconomyMap] ?? null,
    security: SystemSecurityMap?.[message.SystemSecurity as keyof typeof SystemSecurityMap] ?? null,
    powerplayState:
      PowerplayStateMap?.[message.PowerplayState as keyof typeof PowerplayStateMap] ?? null,
    powerplayStateControlProgress: message.PowerplayStateControlProgress,
    powerplayStateReinforcement: message.PowerplayStateReinforcement,
    powerplayStateUndermining: message.PowerplayStateUndermining,
  }

  const validatedSystemData = SystemsInsertSchema.parse(systemData)

  const [system] = await db
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

  // upsert system powerplay powers and cleanup if needed
  if (message.Powers || message.ControllingPower) {
    await db
      .insert(SystemPowerplayPowers)
      .values(powerplayPowers.map((power) => ({ systemId, powerId: power.id })))
      .onConflictDoNothing()

    await db.delete(SystemPowerplayPowers).where(
      and(
        eq(SystemPowerplayPowers.systemId, systemId),
        notInArray(
          SystemPowerplayPowers.powerId,
          powerplayPowers.map((power) => power.id)
        )
      )
    )
  }

  // upsert powerplay conflicts and cleanup if needed
  if (message.PowerplayConflictProgress) {
    const powerplayConflictsData = message.PowerplayConflictProgress.map(
      ({ Power, ConflictProgress }) => ({
        systemId,
        powerId: powerplayPowers.find((power) => power.name === Power)?.id,
        conflictProgress: ConflictProgress,
      })
    ).filter((conflict) => conflict.powerId)

    const validatedPowerplayConflictsData =
      PowerplayConflictsInsertSchema.array().parse(powerplayConflictsData)

    await db
      .insert(PowerplayConflicts)
      .values(validatedPowerplayConflictsData)
      .onConflictDoNothing()

    await db.delete(PowerplayConflicts).where(
      and(
        eq(PowerplayConflicts.systemId, systemId),
        notInArray(
          PowerplayConflicts.powerId,
          validatedPowerplayConflictsData.map((conflict) => conflict.powerId)
        )
      )
    )
  }

  if (message.Factions) {
    // upsert factions
    const factionsData = message.Factions.map((faction) => ({
      name: faction.Name,
      government:
        FactionGovernmentMap?.[faction.Government as keyof typeof FactionGovernmentMap] ?? null,
      allegiance: AllegianceMap?.[faction.Allegiance as keyof typeof AllegianceMap] ?? null,
    }))

    const validatedFactionsData = FactionsInsertSchema.array().parse(factionsData)

    const factions = await db
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

    // upsert system factions
    await db
      .insert(SystemFactions)
      .values(factions.map(({ id }) => ({ systemId, factionId: id })))
      .onConflictDoNothing()

    // cleanup system factions
    await db.delete(SystemFactions).where(
      and(
        eq(SystemFactions.systemId, systemId),
        notInArray(
          SystemFactions.factionId,
          factions.map(({ id }) => id)
        )
      )
    )
  }

  // for each faction
  // get faction states for this system
  // compare pending states, update if incoming state is different
  // compare active states, update if incoming state is different
  // compare recovering states, update if incoming state is different
  // compare influence, update if incoming influence is different
  // compare happiness, update if incoming happiness is different
  // upsert faction states to db

  // for each conflict
  // find involved factions in DB
  // find stations by `stake` in DB
  // upsert conflict to db

  // cleanup conflicts - remove conflicts that are not in the message
}
