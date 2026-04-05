// oxlint-disable no-await-in-loop
import {
  Factions,
  SystemFactions,
  FactionStates,
  FactionConflicts,
  Stations,
  FactionState,
  Systems,
} from '@elitehub/db/schema'
import { eq, and, notInArray, sql } from 'drizzle-orm'
import type {
  EDDNJournalLocationMessage,
  EDDNJournalFSDJumpMessage,
} from '@elitehub/eddn-contracts'
import {
  FactionsInsertSchema,
  FactionStatesInsertSchema,
  FactionConflictsInsertSchema,
} from '../validationSchemas.js'
import {
  mapGovernment,
  mapAllegiance,
  mapHappiness,
  mapFactionState,
  mapFactionConflictType,
  mapFactionConflictStatus,
} from '../constants.js'
import type { Transaction } from './systemHelpers.js'

type FactionMessage = EDDNJournalLocationMessage | EDDNJournalFSDJumpMessage

/**
 * Upserts factions and returns the inserted/updated factions
 */
export const upsertFactions = async (
  tx: Transaction,
  messageFactions: { Name: string; Government: string; Allegiance: string }[]
) => {
  if (!messageFactions || messageFactions.length === 0) {
    return []
  }

  const factionsData = messageFactions.map((faction) => ({
    name: faction.Name,
    government: mapGovernment(faction.Government),
    allegiance: mapAllegiance(faction.Allegiance),
  }))

  const validatedFactionsData = FactionsInsertSchema.array().parse(factionsData)

  const factions = await tx
    .insert(Factions)
    .values(validatedFactionsData)
    .onConflictDoUpdate({
      target: [Factions.name],
      set: {
        government: sql`excluded."government"`,
        allegiance: sql`excluded."allegiance"`,
        updatedAt: new Date(),
      },
    })
    .returning() // No setWhere possible because we need returning()

  return factions
}

/**
 * Creates a map of faction names to their IDs
 */
const createFactionIdMap = (factions: { id: string; name: string }[]) =>
  factions.reduce(
    (acc, faction) => {
      acc[faction.name] = faction.id
      return acc
    },
    {} as Record<string, string>
  )

/**
 * Upserts system factions associations and cleans up stale ones
 */
const upsertSystemFactions = async (
  tx: Transaction,
  systemId: string,
  factions: { id: string }[]
) => {
  await tx
    .insert(SystemFactions)
    .values(factions.map(({ id }) => ({ systemId, factionId: id })))
    .onConflictDoNothing()

  await tx.delete(SystemFactions).where(
    and(
      eq(SystemFactions.systemId, systemId),
      notInArray(
        SystemFactions.factionId,
        factions.map(({ id }) => id)
      )
    )
  )
}

/**
 * Cleans up faction states for factions no longer in the system
 */
const cleanupFactionStates = async (
  tx: Transaction,
  systemId: string,
  factions: { id: string }[]
) => {
  await tx.delete(FactionStates).where(
    and(
      eq(FactionStates.systemId, systemId),
      notInArray(
        FactionStates.factionId,
        factions.map(({ id }) => id)
      )
    )
  )
}

const syncSystemControllingFaction = async (
  tx: Transaction,
  systemId: string,
  controllingFactionId: string | null
) => {
  if (controllingFactionId === null) {
    return
  }

  await tx
    .update(Systems)
    .set({
      controllingFactionId,
      updatedAt: new Date(),
    })
    .where(eq(Systems.id, systemId))
}

/**
 * Maps faction states from message format to database format
 */
const mapFactionStates = (states: { State: string }[] | undefined) =>
  (states ?? []).map((state) => mapFactionState(state.State)).filter(Boolean) as FactionState[]

/**
 * Upserts faction states for all factions in the system
 */
const upsertFactionStates = async (
  tx: Transaction,
  systemId: string,
  message: FactionMessage,
  factionIdMap: Record<string, string>
) => {
  if (!message.Factions) return

  const factionStatesData = message.Factions.map((faction) => ({
    factionId: factionIdMap[faction.Name],
    systemId,
    happiness: mapHappiness(faction.Happiness),
    influence: faction.Influence,
    activeStates: mapFactionStates(faction.ActiveStates),
    recoveringStates: mapFactionStates(faction.RecoveringStates),
    pendingStates: mapFactionStates(faction.PendingStates),
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
        happiness: sql`excluded."happiness"`,
        influence: sql`excluded."influence"`,
        activeStates: sql`excluded."activeStates"`,
        recoveringStates: sql`excluded."recoveringStates"`,
        pendingStates: sql`excluded."pendingStates"`,
        activeStatesRaw: sql`excluded."activeStatesRaw"`,
        recoveringStatesRaw: sql`excluded."recoveringStatesRaw"`,
        pendingStatesRaw: sql`excluded."pendingStatesRaw"`,
        updatedAt: new Date(),
      },
      setWhere: sql`
        "factionStates"."happiness" IS DISTINCT FROM excluded."happiness"
        OR "factionStates"."influence" IS DISTINCT FROM excluded."influence"
        OR "factionStates"."activeStates" IS DISTINCT FROM excluded."activeStates"
        OR "factionStates"."recoveringStates" IS DISTINCT FROM excluded."recoveringStates"
        OR "factionStates"."pendingStates" IS DISTINCT FROM excluded."pendingStates"
        OR "factionStates"."activeStatesRaw" IS DISTINCT FROM excluded."activeStatesRaw"
        OR "factionStates"."recoveringStatesRaw" IS DISTINCT FROM excluded."recoveringStatesRaw"
        OR "factionStates"."pendingStatesRaw" IS DISTINCT FROM excluded."pendingStatesRaw"
      `,
    })
}

/**
 * Finds a faction ID by name
 */
const findFactionId = async (tx: Transaction, name: string) => {
  const result = await tx
    .select({ id: Factions.id })
    .from(Factions)
    .where(eq(Factions.name, name))
    .limit(1)

  return result[0]?.id ?? null
}

/**
 * Finds a station ID by name
 */
const findStationId = async (
  tx: Transaction,
  {
    name,
    systemId,
  }: {
    name: string
    systemId: string
  }
) => {
  if (!name) return null

  const result = await tx
    .select({ id: Stations.id })
    .from(Stations)
    .where(and(eq(Stations.name, name), eq(Stations.systemId, systemId)))
    .limit(1)

  return result[0]?.id ?? null
}

/**
 * Upserts faction conflicts and cleans up stale ones
 */
const upsertFactionConflicts = async (
  tx: Transaction,
  systemId: string,
  message: FactionMessage
) => {
  if (!message.Conflicts || message.Conflicts.length === 0) {
    // Clean up all conflicts for this system if none exist
    await tx.delete(FactionConflicts).where(eq(FactionConflicts.systemId, systemId))
    return
  }

  const conflictsData = []

  for (const conflict of message.Conflicts) {
    const faction1Id = await findFactionId(tx, conflict.Faction1.Name)
    const faction2Id = await findFactionId(tx, conflict.Faction2.Name)

    if (!faction1Id || !faction2Id) {
      console.warn(
        `Could not find factions for conflict: ${conflict.Faction1.Name} vs ${conflict.Faction2.Name}`
      )
      continue
    }

    const factionStakeStationId = await findStationId(tx, {
      name: conflict.Faction1.Stake,
      systemId,
    })
    const opponentStakeStationId = await findStationId(tx, {
      name: conflict.Faction2.Stake,
      systemId,
    })

    conflictsData.push({
      systemId,
      factionId: faction1Id,
      opponentFactionId: faction2Id,
      type: mapFactionConflictType(conflict.WarType),
      status: mapFactionConflictStatus(conflict.Status),
      factionWonDays: conflict.Faction1.WonDays,
      opponentWonDays: conflict.Faction2.WonDays,
      factionStake: conflict.Faction1.Stake,
      factionStakeStationId,
      opponentStake: conflict.Faction2.Stake,
      opponentStakeStationId,
    })
  }

  if (conflictsData.length === 0) {
    await tx.delete(FactionConflicts).where(eq(FactionConflicts.systemId, systemId))
    return
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
        type: sql`excluded."type"`,
        status: sql`excluded."status"`,
        factionWonDays: sql`excluded."factionWonDays"`,
        opponentWonDays: sql`excluded."opponentWonDays"`,
        factionStake: sql`excluded."factionStake"`,
        factionStakeStationId: sql`excluded."factionStakeStationId"`,
        opponentStake: sql`excluded."opponentStake"`,
        opponentStakeStationId: sql`excluded."opponentStakeStationId"`,
        updatedAt: new Date(),
      },
    })
    .returning() // No setWhere possible because we need returning()

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

/**
 * Processes all faction-related data for a system
 */
export const processFactionsData = async (
  tx: Transaction,
  message: FactionMessage,
  systemId: string
) => {
  if (!message.Factions || message.Factions.length === 0) {
    return
  }

  const factions = await upsertFactions(tx, message.Factions)
  const factionIdMap = createFactionIdMap(factions)
  const controllingFactionId = message.SystemFaction?.Name
    ? (factionIdMap[message.SystemFaction.Name] ?? null)
    : null

  await upsertSystemFactions(tx, systemId, factions)
  await cleanupFactionStates(tx, systemId, factions)
  await syncSystemControllingFaction(tx, systemId, controllingFactionId)
  await upsertFactionStates(tx, systemId, message, factionIdMap)
  await upsertFactionConflicts(tx, systemId, message)
}
