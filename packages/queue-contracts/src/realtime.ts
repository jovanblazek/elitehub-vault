import { z } from 'zod'

export const SYSTEM_POWERPLAY_UPDATED_EVENT = 'systemPowerplayUpdated' as const
export const FACTION_PRESENCE_CHANGED_EVENT = 'factionPresenceChanged' as const
export const FACTION_STATE_CHANGED_EVENT = 'factionStateChanged' as const
export const FACTION_CONTROL_THREAT_CHANGED_EVENT = 'factionControlThreatChanged' as const

const getFactionScopedChannel = (eventType: string, factionId: string) =>
  `events:${eventType}:faction:${factionId}`

export const getSystemPowerplayUpdatedPowerChannel = (powerId: string) =>
  `events:systemPowerplayUpdated:power:${powerId}`

export const getFactionPresenceChangedFactionChannel = (factionId: string) =>
  getFactionScopedChannel(FACTION_PRESENCE_CHANGED_EVENT, factionId)

export const getFactionStateChangedFactionChannel = (factionId: string) =>
  getFactionScopedChannel(FACTION_STATE_CHANGED_EVENT, factionId)

export const getFactionControlThreatChangedFactionChannel = (factionId: string) =>
  getFactionScopedChannel(FACTION_CONTROL_THREAT_CHANGED_EVENT, factionId)

export const SYSTEM_POWERPLAY_TRACKED_FIELDS = [
  'powerplayState',
  'powerplayStateControlProgress',
  'powerplayStateReinforcement',
  'powerplayStateUndermining',
] as const

export type SystemPowerplayChangedField = (typeof SYSTEM_POWERPLAY_TRACKED_FIELDS)[number]

export const SystemPowerplayChangedFieldSchema = z.enum(SYSTEM_POWERPLAY_TRACKED_FIELDS)

export const FactionPresenceChangeSchema = z.enum(['entered', 'left'])
export const FactionStateKindSchema = z.enum(['state', 'conflict'])
export const FactionStateLifecycleSchema = z.enum(['pending', 'active', 'ended'])
export const FactionControlThreatStatusSchema = z.enum(['entered', 'cleared'])

export type FactionPresenceChange = z.infer<typeof FactionPresenceChangeSchema>
export type FactionStateKind = z.infer<typeof FactionStateKindSchema>
export type FactionStateLifecycle = z.infer<typeof FactionStateLifecycleSchema>
export type FactionControlThreatStatus = z.infer<typeof FactionControlThreatStatusSchema>

const timestampFromCreatedAt = (createdAt: Date | string) =>
  createdAt instanceof Date ? createdAt.toISOString() : createdAt

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
  metadata: Record<string, unknown>
}

export const FactionPresenceChangedOutboxPayloadSchema = z.object({
  factionId: z.string(),
  systemId: z.string(),
  change: FactionPresenceChangeSchema,
})

export type FactionPresenceChangedOutboxPayload = z.infer<
  typeof FactionPresenceChangedOutboxPayloadSchema
>

export type FactionPresenceChangedPayload = {
  event: typeof FACTION_PRESENCE_CHANGED_EVENT
  factionId: string
  systemId: string
  change: FactionPresenceChange
  timestamp: string
}

export const FactionStateChangedOutboxPayloadSchema = z.object({
  factionId: z.string(),
  systemId: z.string(),
  stateKind: FactionStateKindSchema,
  state: z.string(),
  lifecycle: FactionStateLifecycleSchema,
  opponentFactionId: z.string().optional(),
})

export type FactionStateChangedOutboxPayload = z.infer<typeof FactionStateChangedOutboxPayloadSchema>

export type FactionStateChangedPayload = {
  event: typeof FACTION_STATE_CHANGED_EVENT
  factionId: string
  systemId: string
  stateKind: FactionStateKind
  state: string
  lifecycle: FactionStateLifecycle
  opponentFactionId?: string
  timestamp: string
}

export const FactionControlThreatChangedOutboxPayloadSchema = z.object({
  factionId: z.string(),
  systemId: z.string(),
  status: FactionControlThreatStatusSchema,
  challengerFactionId: z.string(),
  gap: z.number(),
  threshold: z.number(),
})

export type FactionControlThreatChangedOutboxPayload = z.infer<
  typeof FactionControlThreatChangedOutboxPayloadSchema
>

export type FactionControlThreatChangedPayload = {
  event: typeof FACTION_CONTROL_THREAT_CHANGED_EVENT
  factionId: string
  systemId: string
  status: FactionControlThreatStatus
  challengerFactionId: string
  gap: number
  threshold: number
  timestamp: string
}

export type RealtimePayload =
  | SystemPowerplayUpdatedPayload
  | FactionPresenceChangedPayload
  | FactionStateChangedPayload
  | FactionControlThreatChangedPayload

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

export const parseFactionPresenceChangedOutboxPayload = (
  payload: unknown
): FactionPresenceChangedOutboxPayload | null => {
  const parsedPayload = FactionPresenceChangedOutboxPayloadSchema.safeParse(payload)
  if (!parsedPayload.success) {
    return null
  }

  return parsedPayload.data
}

export const parseFactionStateChangedOutboxPayload = (
  payload: unknown
): FactionStateChangedOutboxPayload | null => {
  const parsedPayload = FactionStateChangedOutboxPayloadSchema.safeParse(payload)
  if (!parsedPayload.success) {
    return null
  }

  return parsedPayload.data
}

export const parseFactionControlThreatChangedOutboxPayload = (
  payload: unknown
): FactionControlThreatChangedOutboxPayload | null => {
  const parsedPayload = FactionControlThreatChangedOutboxPayloadSchema.safeParse(payload)
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
  metadata?: Record<string, unknown>
}): SystemPowerplayUpdatedPayload => ({
  event: SYSTEM_POWERPLAY_UPDATED_EVENT,
  systemId: args.systemId,
  powerId: args.powerId,
  changedFields: filterSystemPowerplayChangedFields(args.changedFields),
  timestamp: timestampFromCreatedAt(args.createdAt),
  metadata: args.metadata ?? {},
})

export const buildFactionPresenceChangedPayload = (args: {
  factionId: string
  systemId: string
  change: FactionPresenceChange
  createdAt: Date | string
}): FactionPresenceChangedPayload => ({
  event: FACTION_PRESENCE_CHANGED_EVENT,
  factionId: args.factionId,
  systemId: args.systemId,
  change: args.change,
  timestamp: timestampFromCreatedAt(args.createdAt),
})

export const buildFactionStateChangedPayload = (args: {
  factionId: string
  systemId: string
  stateKind: FactionStateKind
  state: string
  lifecycle: FactionStateLifecycle
  opponentFactionId?: string
  createdAt: Date | string
}): FactionStateChangedPayload => ({
  event: FACTION_STATE_CHANGED_EVENT,
  factionId: args.factionId,
  systemId: args.systemId,
  stateKind: args.stateKind,
  state: args.state,
  lifecycle: args.lifecycle,
  ...(args.opponentFactionId ? { opponentFactionId: args.opponentFactionId } : {}),
  timestamp: timestampFromCreatedAt(args.createdAt),
})

export const buildFactionControlThreatChangedPayload = (args: {
  factionId: string
  systemId: string
  status: FactionControlThreatStatus
  challengerFactionId: string
  gap: number
  threshold: number
  createdAt: Date | string
}): FactionControlThreatChangedPayload => ({
  event: FACTION_CONTROL_THREAT_CHANGED_EVENT,
  factionId: args.factionId,
  systemId: args.systemId,
  status: args.status,
  challengerFactionId: args.challengerFactionId,
  gap: args.gap,
  threshold: args.threshold,
  timestamp: timestampFromCreatedAt(args.createdAt),
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
    metadata: parsedPayload.metadata,
  })
}

export const buildFactionPresenceChangedPublishTarget = (args: {
  outboxPayload: unknown
  createdAt: Date
}): { channel: string; payload: FactionPresenceChangedPayload } | null => {
  const parsedPayload = parseFactionPresenceChangedOutboxPayload(args.outboxPayload)
  if (!parsedPayload) {
    return null
  }

  return {
    channel: getFactionPresenceChangedFactionChannel(parsedPayload.factionId),
    payload: buildFactionPresenceChangedPayload({
      factionId: parsedPayload.factionId,
      systemId: parsedPayload.systemId,
      change: parsedPayload.change,
      createdAt: args.createdAt,
    }),
  }
}

export const buildFactionStateChangedPublishTarget = (args: {
  outboxPayload: unknown
  createdAt: Date
}): { channel: string; payload: FactionStateChangedPayload } | null => {
  const parsedPayload = parseFactionStateChangedOutboxPayload(args.outboxPayload)
  if (!parsedPayload) {
    return null
  }

  return {
    channel: getFactionStateChangedFactionChannel(parsedPayload.factionId),
    payload: buildFactionStateChangedPayload({
      factionId: parsedPayload.factionId,
      systemId: parsedPayload.systemId,
      stateKind: parsedPayload.stateKind,
      state: parsedPayload.state,
      lifecycle: parsedPayload.lifecycle,
      opponentFactionId: parsedPayload.opponentFactionId,
      createdAt: args.createdAt,
    }),
  }
}

export const buildFactionControlThreatChangedPublishTarget = (args: {
  outboxPayload: unknown
  createdAt: Date
}): { channel: string; payload: FactionControlThreatChangedPayload } | null => {
  const parsedPayload = parseFactionControlThreatChangedOutboxPayload(args.outboxPayload)
  if (!parsedPayload) {
    return null
  }

  return {
    channel: getFactionControlThreatChangedFactionChannel(parsedPayload.factionId),
    payload: buildFactionControlThreatChangedPayload({
      factionId: parsedPayload.factionId,
      systemId: parsedPayload.systemId,
      status: parsedPayload.status,
      challengerFactionId: parsedPayload.challengerFactionId,
      gap: parsedPayload.gap,
      threshold: parsedPayload.threshold,
      createdAt: args.createdAt,
    }),
  }
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
