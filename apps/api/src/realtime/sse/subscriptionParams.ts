import { z } from 'zod'
import {
  FACTION_CONTROL_THREAT_CHANGED_EVENT,
  FACTION_PRESENCE_CHANGED_EVENT,
  FACTION_STATE_CHANGED_EVENT,
  SYSTEM_POWERPLAY_UPDATED_EVENT,
} from '@elitehub/queue-contracts'

const SystemIdSchema = z.array(z.string().min(1)).max(20).optional()

const PowerplaySubscriptionQuerySchema = z.object({
  eventType: z.literal(SYSTEM_POWERPLAY_UPDATED_EVENT),
  powerId: z.array(z.string().min(1)).min(1).max(4),
  systemId: SystemIdSchema,
})

const FactionSubscriptionQuerySchema = z.object({
  eventType: z.enum([
    FACTION_PRESENCE_CHANGED_EVENT,
    FACTION_STATE_CHANGED_EVENT,
    FACTION_CONTROL_THREAT_CHANGED_EVENT,
  ]),
  factionId: z.array(z.string().min(1)).min(1).max(20),
  systemId: SystemIdSchema,
})

type PowerplaySubscriptionQuery = {
  eventType: typeof SYSTEM_POWERPLAY_UPDATED_EVENT
  routingKeyParam: 'powerId'
  routingKeys: string[]
  systemIds: string[] | null
}

type FactionSubscriptionQuery = {
  eventType:
    | typeof FACTION_PRESENCE_CHANGED_EVENT
    | typeof FACTION_STATE_CHANGED_EVENT
    | typeof FACTION_CONTROL_THREAT_CHANGED_EVENT
  routingKeyParam: 'factionId'
  routingKeys: string[]
  systemIds: string[] | null
}

export type SseSubscriptionQuery = PowerplaySubscriptionQuery | FactionSubscriptionQuery

const dedupeList = (values: string[]) => Array.from(new Set(values))

const buildError = (error: z.ZodError) => {
  const firstIssue = error.issues[0]
  return firstIssue ? `${firstIssue.path.join('.')}: ${firstIssue.message}` : 'Invalid query'
}

export const parseSseSubscriptionQuery = (
  searchParams: URLSearchParams
): { success: true; data: SseSubscriptionQuery } | { success: false; error: string } => {
  const eventType = searchParams.get('eventType') ?? undefined
  const systemIds = searchParams.getAll('systemId')

  if (eventType === SYSTEM_POWERPLAY_UPDATED_EVENT) {
    const parsed = PowerplaySubscriptionQuerySchema.safeParse({
      eventType,
      powerId: searchParams.getAll('powerId'),
      systemId: systemIds.length === 0 ? undefined : systemIds,
    })

    if (!parsed.success) {
      return {
        success: false,
        error: buildError(parsed.error),
      }
    }

    return {
      success: true,
      data: {
        eventType: parsed.data.eventType,
        routingKeyParam: 'powerId',
        routingKeys: dedupeList(parsed.data.powerId),
        systemIds: parsed.data.systemId ? dedupeList(parsed.data.systemId) : null,
      },
    }
  }

  const parsed = FactionSubscriptionQuerySchema.safeParse({
    eventType,
    factionId: searchParams.getAll('factionId'),
    systemId: systemIds.length === 0 ? undefined : systemIds,
  })

  if (!parsed.success) {
    return {
      success: false,
      error: buildError(parsed.error),
    }
  }

  return {
    success: true,
    data: {
      eventType: parsed.data.eventType,
      routingKeyParam: 'factionId',
      routingKeys: dedupeList(parsed.data.factionId),
      systemIds: parsed.data.systemId ? dedupeList(parsed.data.systemId) : null,
    },
  }
}
