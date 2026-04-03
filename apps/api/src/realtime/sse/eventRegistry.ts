import { z } from 'zod'
import {
  getSystemPowerplayUpdatedPowerChannel,
  SystemPowerplayChangedFieldSchema,
  SYSTEM_POWERPLAY_UPDATED_EVENT,
  type SystemPowerplayUpdatedPayload,
} from '../systemPowerplayUpdated.js'

const SystemPowerplayUpdatedPayloadSchema = z.object({
  event: z.literal(SYSTEM_POWERPLAY_UPDATED_EVENT),
  systemId: z.string(),
  powerId: z.string(),
  changedFields: z.array(SystemPowerplayChangedFieldSchema),
  timestamp: z.string(),
  source: z.string(),
  metadata: z.record(z.string(), z.unknown()),
})

export type SseConnectionFilter = {
  systemIdAllowlist: Set<string> | null
}

export type RealtimeEventSpec<TPayload> = {
  eventType: string
  getChannel: (powerId: string) => string
  parsePowerIdFromChannel: (channel: string) => string | null
  parsePayload: (message: string) => TPayload | null
  matchesConnectionFilters: (connection: SseConnectionFilter, payload: TPayload) => boolean
  toSseData: (payload: TPayload) => string
}

const parseSystemPowerplayUpdatedPowerId = (channel: string): string | null => {
  const prefix = 'events:systemPowerplayUpdated:power:'
  if (!channel.startsWith(prefix)) {
    return null
  }

  const powerId = channel.slice(prefix.length)
  return powerId.length > 0 ? powerId : null
}

const systemPowerplayUpdatedSpec: RealtimeEventSpec<SystemPowerplayUpdatedPayload> = {
  eventType: SYSTEM_POWERPLAY_UPDATED_EVENT,
  getChannel: getSystemPowerplayUpdatedPowerChannel,
  parsePowerIdFromChannel: parseSystemPowerplayUpdatedPowerId,
  parsePayload: (message) => {
    let parsed: unknown
    try {
      parsed = JSON.parse(message)
    } catch {
      return null
    }

    const payload = SystemPowerplayUpdatedPayloadSchema.safeParse(parsed)
    if (!payload.success) {
      return null
    }

    return payload.data
  },
  matchesConnectionFilters: (connection, payload) => {
    if (!connection.systemIdAllowlist) {
      return true
    }

    return connection.systemIdAllowlist.has(payload.systemId)
  },
  toSseData: (payload) => JSON.stringify(payload),
}

const RealtimeEventSpecs = {
  [SYSTEM_POWERPLAY_UPDATED_EVENT]: systemPowerplayUpdatedSpec,
} as const

export type RealtimeEventType = keyof typeof RealtimeEventSpecs

export const getRealtimeEventSpec = (eventType: string): RealtimeEventSpec<SystemPowerplayUpdatedPayload> | null =>
  RealtimeEventSpecs[eventType as RealtimeEventType] ?? null

export const findRealtimeEventByChannel = (
  channel: string
): {
  eventType: RealtimeEventType
  spec: RealtimeEventSpec<SystemPowerplayUpdatedPayload>
  powerId: string
} | null => {
  for (const [eventType, spec] of Object.entries(RealtimeEventSpecs) as [
    RealtimeEventType,
    RealtimeEventSpec<SystemPowerplayUpdatedPayload>,
  ][]) {
    const powerId = spec.parsePowerIdFromChannel(channel)
    if (!powerId) {
      continue
    }

    return {
      eventType,
      spec,
      powerId,
    }
  }

  return null
}
