import { eq } from 'drizzle-orm'
import { FactionState, FactionStateHistory, FactionStates } from '@elitehub/db/schema'
import type {
  EDDNJournalFSDJumpMessage,
  EDDNJournalLocationMessage,
} from '@elitehub/eddn-contracts'
import { FactionStateHistoryInsertSchema } from '../validationSchemas.js'
import { mapHappiness, mapFactionState } from '../constants.js'
import type { Transaction } from './systemHelpers.js'

export type FactionMessage = EDDNJournalLocationMessage | EDDNJournalFSDJumpMessage

export type FactionStateInsertRow = typeof FactionStates.$inferInsert

export type FactionStateHistoryRow = typeof FactionStateHistory.$inferSelect

/**
 * Maps faction states from message format to database format
 */
const mapFactionStates = (states: { State: string }[] | undefined) =>
  (states ?? []).map((state) => mapFactionState(state.State)).filter(Boolean) as FactionState[]

export const buildFactionStateWriteRows = (
  systemId: string,
  message: FactionMessage,
  factionIdMap: Record<string, string>
): FactionStateInsertRow[] =>
  (message.Factions ?? []).map((faction) => ({
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

// TODO: Review this function and file as a whole, we probably don't need to check raw state values
const factionStateRowsMatch = (
  existingRow: FactionStateHistoryRow,
  incomingRow: FactionStateInsertRow
) =>
  existingRow.happiness === incomingRow.happiness &&
  existingRow.influence === incomingRow.influence &&
  JSON.stringify(existingRow.activeStates) === JSON.stringify(incomingRow.activeStates) &&
  JSON.stringify(existingRow.recoveringStates) === JSON.stringify(incomingRow.recoveringStates) &&
  JSON.stringify(existingRow.pendingStates) === JSON.stringify(incomingRow.pendingStates) &&
  JSON.stringify(existingRow.activeStatesRaw) === JSON.stringify(incomingRow.activeStatesRaw) &&
  JSON.stringify(existingRow.recoveringStatesRaw) ===
    JSON.stringify(incomingRow.recoveringStatesRaw) &&
  JSON.stringify(existingRow.pendingStatesRaw) === JSON.stringify(incomingRow.pendingStatesRaw)

export const buildFactionStateHistoryRows = ({
  existingRows,
  incomingRows,
}: {
  existingRows: FactionStateHistoryRow[]
  incomingRows: FactionStateInsertRow[]
}) => {
  const existingByFactionId = new Map(existingRows.map((row) => [row.factionId, row]))
  const incomingFactionIds = new Set(incomingRows.map((row) => row.factionId))

  const changedOrNewRows = incomingRows
    .filter((row) => {
      const existingRow = existingByFactionId.get(row.factionId)
      return !existingRow || !factionStateRowsMatch(existingRow, row)
    })
    .map((row) => Object.assign(row, { isPresent: true }))

  const removedRows = existingRows
    .filter((row) => !incomingFactionIds.has(row.factionId))
    .map((row) => Object.assign(row, { isPresent: false }))

  return [...changedOrNewRows, ...removedRows]
}

export const appendFactionStateHistory = async (
  tx: Transaction,
  systemId: string,
  message: FactionMessage,
  factionIdMap: Record<string, string>
) => {
  const incomingRows = buildFactionStateWriteRows(systemId, message, factionIdMap)
  const existingRows = await tx
    .select()
    .from(FactionStates)
    .where(eq(FactionStates.systemId, systemId))

  const historyRows = buildFactionStateHistoryRows({
    existingRows: existingRows.map((row) => Object.assign(row, { isPresent: true })),
    incomingRows,
  })

  if (historyRows.length === 0) {
    return
  }

  const validatedHistoryRows = FactionStateHistoryInsertSchema.array().parse(historyRows)
  await tx.insert(FactionStateHistory).values(validatedHistoryRows)
}
