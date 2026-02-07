import { z } from 'zod'
import { SYSTEM_POWERPLAY_UPDATED_EVENT } from '../systemPowerplayUpdated.js'

const SseSubscriptionQuerySchema = z.object({
  eventType: z.literal(SYSTEM_POWERPLAY_UPDATED_EVENT),
  powerId: z.array(z.string().min(1)).min(1).max(4),
  systemId: z.array(z.string().min(1)).max(20).optional(),
})

export type SseSubscriptionQuery = {
  eventType: typeof SYSTEM_POWERPLAY_UPDATED_EVENT
  powerIds: string[]
  systemIds: string[] | null
}

const dedupeList = (values: string[]) => Array.from(new Set(values))

export const parseSseSubscriptionQuery = (
  searchParams: URLSearchParams
): { success: true; data: SseSubscriptionQuery } | { success: false; error: string } => {
  const systemIds = searchParams.getAll('systemId')
  const parsed = SseSubscriptionQuerySchema.safeParse({
    eventType: searchParams.get('eventType') ?? undefined,
    powerId: searchParams.getAll('powerId'),
    systemId: systemIds.length === 0 ? undefined : systemIds,
  })

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    return {
      success: false,
      error: firstIssue ? `${firstIssue.path.join('.')}: ${firstIssue.message}` : 'Invalid query',
    }
  }

  return {
    success: true,
    data: {
      eventType: parsed.data.eventType,
      powerIds: dedupeList(parsed.data.powerId),
      systemIds: parsed.data.systemId ? dedupeList(parsed.data.systemId) : null,
    },
  }
}
