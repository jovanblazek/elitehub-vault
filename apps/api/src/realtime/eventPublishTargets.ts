import {
  buildFactionControlThreatChangedPublishTarget,
  buildFactionPresenceChangedPublishTarget,
  buildFactionStateChangedPublishTarget,
  buildSystemPowerplayPublishTargets,
  FACTION_CONTROL_THREAT_CHANGED_EVENT,
  FACTION_PRESENCE_CHANGED_EVENT,
  FACTION_STATE_CHANGED_EVENT,
  SYSTEM_POWERPLAY_UPDATED_EVENT,
  type RealtimePayload,
} from '@elitehub/queue-contracts'

type RealtimePublishTarget = {
  channel: string
  payload: RealtimePayload
}

export const buildPublishTargetsForOutboxRow = (args: {
  eventType: string
  outboxPayload: unknown
  createdAt: Date
  powerIds?: string[]
}): RealtimePublishTarget[] | null => {
  switch (args.eventType) {
    case SYSTEM_POWERPLAY_UPDATED_EVENT:
      return buildSystemPowerplayPublishTargets({
        outboxPayload: args.outboxPayload,
        createdAt: args.createdAt,
        powerIds: args.powerIds ?? [],
      })

    case FACTION_PRESENCE_CHANGED_EVENT: {
      const target = buildFactionPresenceChangedPublishTarget({
        outboxPayload: args.outboxPayload,
        createdAt: args.createdAt,
      })
      return target ? [target] : []
    }

    case FACTION_STATE_CHANGED_EVENT: {
      const target = buildFactionStateChangedPublishTarget({
        outboxPayload: args.outboxPayload,
        createdAt: args.createdAt,
      })
      return target ? [target] : []
    }

    case FACTION_CONTROL_THREAT_CHANGED_EVENT: {
      const target = buildFactionControlThreatChangedPublishTarget({
        outboxPayload: args.outboxPayload,
        createdAt: args.createdAt,
      })
      return target ? [target] : []
    }

    default:
      return null
  }
}
