import { createInsertSchema } from 'drizzle-zod'
import {
  Systems,
  Factions,
  FactionStates,
  FactionConflicts,
  Stations,
  PowerplayConflicts,
  stationServiceValues,
} from '@elitehub/db/schema'
import { z } from 'zod'

export const SystemsInsertSchema = createInsertSchema(Systems)
export const FactionsInsertSchema = createInsertSchema(Factions)
export const FactionStatesInsertSchema = createInsertSchema(FactionStates)
export const FactionConflictsInsertSchema = createInsertSchema(FactionConflicts)
export const StationServiceSchema = z.enum(stationServiceValues)
export const StationServicesV2Schema = z.array(StationServiceSchema)
export const StationsInsertSchema = createInsertSchema(Stations).extend({
  servicesV2: StationServicesV2Schema.optional(),
})
export const PowerplayConflictsInsertSchema = createInsertSchema(PowerplayConflicts)
