import { Economy, FactionConflicts, Stations, StationType } from '../schema.js'
import { createDb } from '../db.js'
import { and, desc, eq, inArray, or, sql } from 'drizzle-orm'
import { dbEnv } from '../../drizzle.config.js'

const STRONGHOLD_CARRIER_NAME = 'Stronghold Carrier'
const STRONGHOLD_CARRIER_NAMES = [
  STRONGHOLD_CARRIER_NAME,
  'Hochburg-Carrier',
  'Portanaves bastión',
  'Porte-vaisseaux de forteresse',
  'Transportadora da potência',
  'Носитель-база',
] as const
const STRONGHOLD_CARRIER_SMALL_PADS = 4
const STRONGHOLD_CARRIER_MEDIUM_PADS = 4
const STRONGHOLD_CARRIER_LARGE_PADS = 2

const db = createDb({ connectionString: dbEnv.POSTGRES_CONNECTION_STRING })
const isDryRun = process.argv.includes('--dry-run')

const main = async () => {
  const result = await db.transaction(async (tx) => {
    const carriers = await tx
      .select()
      .from(Stations)
      .where(
        and(
          inArray(Stations.name, STRONGHOLD_CARRIER_NAMES),
          eq(Stations.stationType, StationType.PlanetaryOutpost),
          eq(Stations.economy, Economy.HighTech),
          eq(Stations.landingPadsSmall, STRONGHOLD_CARRIER_SMALL_PADS),
          eq(Stations.landingPadsMedium, STRONGHOLD_CARRIER_MEDIUM_PADS),
          eq(Stations.landingPadsLarge, STRONGHOLD_CARRIER_LARGE_PADS)
        )
      )
      .orderBy(desc(Stations.updatedAt), desc(Stations.createdAt))

    const carriersBySystem = new Map<string, typeof carriers>()
    for (const carrier of carriers) {
      const systemCarriers = carriersBySystem.get(carrier.systemId) ?? []
      systemCarriers.push(carrier)
      carriersBySystem.set(carrier.systemId, systemCarriers)
    }

    const survivorIdsToRename: string[] = []
    const duplicateReplacements: { duplicateId: string; survivorId: string }[] = []

    for (const systemCarriers of carriersBySystem.values()) {
      const [survivor, ...duplicates] = systemCarriers
      if (!survivor) {
        continue
      }

      duplicateReplacements.push(
        ...duplicates.map((duplicate) => ({
          duplicateId: duplicate.id,
          survivorId: survivor.id,
        }))
      )

      if (survivor.name !== STRONGHOLD_CARRIER_NAME) {
        survivorIdsToRename.push(survivor.id)
      }
    }

    const duplicateIds = duplicateReplacements.map(({ duplicateId }) => duplicateId)
    let updatedFactionConflicts = 0

    if (duplicateIds.length > 0) {
      if (isDryRun) {
        const conflicts = await tx
          .select({ id: FactionConflicts.id })
          .from(FactionConflicts)
          .where(
            or(
              inArray(FactionConflicts.factionStakeStationId, duplicateIds),
              inArray(FactionConflicts.opponentStakeStationId, duplicateIds)
            )
          )
        updatedFactionConflicts = conflicts.length
      } else {
        const factionStakeReplacement = sql`CASE ${FactionConflicts.factionStakeStationId}
          ${sql.join(
            duplicateReplacements.map(
              ({ duplicateId, survivorId }) => sql`WHEN ${duplicateId} THEN ${survivorId}`
            ),
            sql.raw(' ')
          )}
          ELSE ${FactionConflicts.factionStakeStationId} END`
        const opponentStakeReplacement = sql`CASE ${FactionConflicts.opponentStakeStationId}
          ${sql.join(
            duplicateReplacements.map(
              ({ duplicateId, survivorId }) => sql`WHEN ${duplicateId} THEN ${survivorId}`
            ),
            sql.raw(' ')
          )}
          ELSE ${FactionConflicts.opponentStakeStationId} END`

        const conflicts = await tx
          .update(FactionConflicts)
          .set({
            factionStakeStationId: factionStakeReplacement,
            opponentStakeStationId: opponentStakeReplacement,
          })
          .where(
            or(
              inArray(FactionConflicts.factionStakeStationId, duplicateIds),
              inArray(FactionConflicts.opponentStakeStationId, duplicateIds)
            )
          )
          .returning({ id: FactionConflicts.id })
        updatedFactionConflicts = conflicts.length

        await tx.delete(Stations).where(inArray(Stations.id, duplicateIds))
      }
    }

    if (!isDryRun && survivorIdsToRename.length > 0) {
      await tx
        .update(Stations)
        .set({ name: STRONGHOLD_CARRIER_NAME, updatedAt: new Date() })
        .where(inArray(Stations.id, survivorIdsToRename))
    }

    return {
      matched: carriers.length,
      renamed: survivorIdsToRename.length,
      removedDuplicates: duplicateIds.length,
      updatedFactionConflicts,
    }
  })

  if (isDryRun) {
    console.log(
      `[DB] Stronghold carrier normalization dry run: ${result.matched} matched, ${result.renamed} would be renamed, ${result.removedDuplicates} duplicates would be removed, ${result.updatedFactionConflicts} faction conflicts would be updated. No changes were made.`
    )
  } else {
    console.log(
      `[DB] Stronghold carrier normalization complete: ${result.matched} matched, ${result.renamed} renamed, ${result.removedDuplicates} duplicates removed, ${result.updatedFactionConflicts} faction conflicts updated.`
    )
  }
  process.exit(0)
}

main().catch((error: unknown) => {
  console.error('[DB] Stronghold carrier normalization failed.', error)
  process.exit(1)
})
