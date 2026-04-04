import { z } from 'zod'
import {
  FACTION_CONTROL_THREAT_CHANGED_EVENT,
  FACTION_PRESENCE_CHANGED_EVENT,
  FACTION_STATE_CHANGED_EVENT,
  getFactionControlThreatChangedFactionChannel,
  getFactionPresenceChangedFactionChannel,
  getFactionStateChangedFactionChannel,
  getSystemPowerplayUpdatedPowerChannel,
  type RealtimePayload,
  SYSTEM_POWERPLAY_UPDATED_EVENT,
  SystemPowerplayChangedFieldSchema,
} from '@elitehub/queue-contracts'

const SystemPowerplayUpdatedPayloadSchema = z.object({
  event: z.literal(SYSTEM_POWERPLAY_UPDATED_EVENT),
  systemId: z.string(),
  powerId: z.string(),
  changedFields: z.array(SystemPowerplayChangedFieldSchema),
  timestamp: z.string(),
  source: z.string(),
  metadata: z.record(z.string(), z.unknown()),
})

const FactionPresenceChangedPayloadSchema = z.object({
  event: z.literal(FACTION_PRESENCE_CHANGED_EVENT),
  factionId: z.string(),
  systemId: z.string(),
  change: z.enum(['entered', 'left']),
  timestamp: z.string(),
})

const FactionStateChangedPayloadSchema = z.object({
  event: z.literal(FACTION_STATE_CHANGED_EVENT),
  factionId: z.string(),
  systemId: z.string(),
  stateKind: z.enum(['state', 'conflict']),
  state: z.string(),
  lifecycle: z.enum(['pending', 'active', 'ended']),
  opponentFactionId: z.string().optional(),
  timestamp: z.string(),
})

const FactionControlThreatChangedPayloadSchema = z.object({
  event: z.literal(FACTION_CONTROL_THREAT_CHANGED_EVENT),
  factionId: z.string(),
  systemId: z.string(),
  status: z.enum(['entered', 'cleared']),
  challengerFactionId: z.string(),
  gap: z.number(),
  threshold: z.number(),
  timestamp: z.string(),
})

export type SseConnectionFilter = {
  systemIdAllowlist: Set<string> | null
}

export type RealtimeEventType =
  | typeof SYSTEM_POWERPLAY_UPDATED_EVENT
  | typeof FACTION_PRESENCE_CHANGED_EVENT
  | typeof FACTION_STATE_CHANGED_EVENT
  | typeof FACTION_CONTROL_THREAT_CHANGED_EVENT

export type RealtimeEventSpec = {
  eventType: RealtimeEventType
  routingKeyParam: 'powerId' | 'factionId'
  getChannel: (routingKey: string) => string
  parseRoutingKeyFromChannel: (channel: string) => string | null
  parsePayload: (message: string) => RealtimePayload | null
  matchesConnectionFilters: (connection: SseConnectionFilter, payload: RealtimePayload) => boolean
  toSseData: (payload: RealtimePayload) => string
}

const parsePayload = <TPayload extends RealtimePayload>(
  message: string,
  schema: z.ZodSchema<TPayload>
): TPayload | null => {
  let parsed: unknown
  try {
    parsed = JSON.parse(message)
  } catch {
    return null
  }

  const payload = schema.safeParse(parsed)
  if (!payload.success) {
    return null
  }

  return payload.data
}

const parseRoutingKeyFromChannel = (prefix: string) => (channel: string): string | null => {
  if (!channel.startsWith(prefix)) {
    return null
  }

  const routingKey = channel.slice(prefix.length)
  return routingKey.length > 0 ? routingKey : null
}

const matchesSystemIdFilter = (connection: SseConnectionFilter, payload: RealtimePayload) => {
  if (!connection.systemIdAllowlist) {
    return true
  }

  return connection.systemIdAllowlist.has(payload.systemId)
}

const RealtimeEventSpecs: Record<RealtimeEventType, RealtimeEventSpec> = {
  [SYSTEM_POWERPLAY_UPDATED_EVENT]: {
    eventType: SYSTEM_POWERPLAY_UPDATED_EVENT,
    routingKeyParam: 'powerId',
    getChannel: getSystemPowerplayUpdatedPowerChannel,
    parseRoutingKeyFromChannel: parseRoutingKeyFromChannel('events:systemPowerplayUpdated:power:'),
    parsePayload: (message) => parsePayload(message, SystemPowerplayUpdatedPayloadSchema),
    matchesConnectionFilters: matchesSystemIdFilter,
    toSseData: (payload) => JSON.stringify(payload),
  },
  [FACTION_PRESENCE_CHANGED_EVENT]: {
    eventType: FACTION_PRESENCE_CHANGED_EVENT,
    routingKeyParam: 'factionId',
    getChannel: getFactionPresenceChangedFactionChannel,
    parseRoutingKeyFromChannel: parseRoutingKeyFromChannel('events:factionPresenceChanged:faction:'),
    parsePayload: (message) => parsePayload(message, FactionPresenceChangedPayloadSchema),
    matchesConnectionFilters: matchesSystemIdFilter,
    toSseData: (payload) => JSON.stringify(payload),
  },
  [FACTION_STATE_CHANGED_EVENT]: {
    eventType: FACTION_STATE_CHANGED_EVENT,
    routingKeyParam: 'factionId',
    getChannel: getFactionStateChangedFactionChannel,
    parseRoutingKeyFromChannel: parseRoutingKeyFromChannel('events:factionStateChanged:faction:'),
    parsePayload: (message) => parsePayload(message, FactionStateChangedPayloadSchema),
    matchesConnectionFilters: matchesSystemIdFilter,
    toSseData: (payload) => JSON.stringify(payload),
  },
  [FACTION_CONTROL_THREAT_CHANGED_EVENT]: {
    eventType: FACTION_CONTROL_THREAT_CHANGED_EVENT,
    routingKeyParam: 'factionId',
    getChannel: getFactionControlThreatChangedFactionChannel,
    parseRoutingKeyFromChannel: parseRoutingKeyFromChannel(
      'events:factionControlThreatChanged:faction:'
    ),
    parsePayload: (message) => parsePayload(message, FactionControlThreatChangedPayloadSchema),
    matchesConnectionFilters: matchesSystemIdFilter,
    toSseData: (payload) => JSON.stringify(payload),
  },
}

export const getRealtimeEventSpec = (eventType: string): RealtimeEventSpec | null =>
  RealtimeEventSpecs[eventType as RealtimeEventType] ?? null

export const findRealtimeEventByChannel = (
  channel: string
): {
  eventType: RealtimeEventType
  spec: RealtimeEventSpec
  routingKey: string
} | null => {
  for (const [eventType, spec] of Object.entries(RealtimeEventSpecs) as [
    RealtimeEventType,
    RealtimeEventSpec,
  ][]) {
    const routingKey = spec.parseRoutingKeyFromChannel(channel)
    if (!routingKey) {
      continue
    }

    return {
      eventType,
      spec,
      routingKey,
    }
  }

  return null
}
