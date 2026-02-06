import { z } from 'zod'

export const SYSTEM_POWERPLAY_UPDATED_EVENT = 'systemPowerplayUpdated' as const
export const getSystemPowerplayUpdatedPowerChannel = (powerId: string) =>
  `events:systemPowerplayUpdated:power:${powerId}`

export const SYSTEM_POWERPLAY_TRACKED_FIELDS = [
  'powerplayState',
  'powerplayStateControlProgress',
  'powerplayStateReinforcement',
  'powerplayStateUndermining',
] as const

export type SystemPowerplayChangedField = (typeof SYSTEM_POWERPLAY_TRACKED_FIELDS)[number]

export const SystemPowerplayChangedFieldSchema = z.enum(SYSTEM_POWERPLAY_TRACKED_FIELDS)

export const SystemPowerplayUpdatedOutboxPayloadSchema = z.object({
  systemId: z.string(),
  changedFields: z.array(z.string()),
  source: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export type SystemPowerplayUpdatedOutboxPayload = z.infer<
  typeof SystemPowerplayUpdatedOutboxPayloadSchema
>

export type SystemPowerplayUpdatedPayload = {
  event: typeof SYSTEM_POWERPLAY_UPDATED_EVENT
  systemId: string
  powerId: string
  changedFields: SystemPowerplayChangedField[]
  timestamp: string
  source: string
  metadata: Record<string, unknown>
}

const SystemPowerplayTrackedFieldsSet = new Set<string>(SYSTEM_POWERPLAY_TRACKED_FIELDS)

export const filterSystemPowerplayChangedFields = (
  fields: string[]
): SystemPowerplayChangedField[] =>
  fields.filter((field): field is SystemPowerplayChangedField =>
    SystemPowerplayTrackedFieldsSet.has(field)
  )

export const buildSystemPowerplayUpdatedPayload = (args: {
  systemId: string
  powerId: string
  changedFields: string[]
  createdAt: Date | string
  source?: string
  metadata?: Record<string, unknown>
}): SystemPowerplayUpdatedPayload => ({
  event: SYSTEM_POWERPLAY_UPDATED_EVENT,
  systemId: args.systemId,
  powerId: args.powerId,
  changedFields: filterSystemPowerplayChangedFields(args.changedFields),
  timestamp: args.createdAt instanceof Date ? args.createdAt.toISOString() : args.createdAt,
  source: args.source ?? 'eddn-worker',
  metadata: args.metadata ?? {},
})
