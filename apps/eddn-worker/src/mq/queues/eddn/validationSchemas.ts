import { createInsertSchema } from 'drizzle-zod'
import {
  Systems,
  Factions,
  FactionStates,
  FactionConflicts,
  Stations,
  PowerplayConflicts,
} from '../../../db/schema.js'

export const SystemsInsertSchema = createInsertSchema(Systems)
export const FactionsInsertSchema = createInsertSchema(Factions)
export const FactionStatesInsertSchema = createInsertSchema(FactionStates)
export const FactionConflictsInsertSchema = createInsertSchema(FactionConflicts)
export const StationsInsertSchema = createInsertSchema(Stations)
export const PowerplayConflictsInsertSchema = createInsertSchema(PowerplayConflicts)
