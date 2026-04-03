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

const trackedFields = new Set<string>(SYSTEM_POWERPLAY_TRACKED_FIELDS)

export const filterSystemPowerplayChangedFields = (
  fields: string[]
): SystemPowerplayChangedField[] =>
  fields.filter((field): field is SystemPowerplayChangedField => trackedFields.has(field))

export const parseSystemPowerplayUpdatedOutboxPayload = (
  payload: unknown
): SystemPowerplayUpdatedOutboxPayload | null => {
  const parsedPayload = SystemPowerplayUpdatedOutboxPayloadSchema.safeParse(payload)
  if (!parsedPayload.success) {
    return null
  }

  return parsedPayload.data
}

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

export const buildSystemPowerplayUpdatedPowerScopedPayload = (args: {
  outboxPayload: unknown
  createdAt: Date
  powerId: string
}): SystemPowerplayUpdatedPayload | null => {
  const parsedPayload = parseSystemPowerplayUpdatedOutboxPayload(args.outboxPayload)
  if (!parsedPayload) {
    return null
  }

  return buildSystemPowerplayUpdatedPayload({
    systemId: parsedPayload.systemId,
    powerId: args.powerId,
    changedFields: parsedPayload.changedFields,
    createdAt: args.createdAt,
    source: parsedPayload.source,
    metadata: parsedPayload.metadata,
  })
}

export const buildSystemPowerplayPublishTargets = (args: {
  outboxPayload: unknown
  createdAt: Date
  powerIds: string[]
}): { channel: string; payload: SystemPowerplayUpdatedPayload }[] => {
  const targets = []

  for (const powerId of args.powerIds) {
    const payload = buildSystemPowerplayUpdatedPowerScopedPayload({
      outboxPayload: args.outboxPayload,
      createdAt: args.createdAt,
      powerId,
    })

    if (!payload) {
      return []
    }

    targets.push({
      channel: getSystemPowerplayUpdatedPowerChannel(powerId),
      payload,
    })
  }

  return targets
}
