import { buildSystemPowerplayUpdatedPowerScopedPayload } from './eventPayloads.js'
import {
  getSystemPowerplayUpdatedPowerChannel,
  type SystemPowerplayUpdatedPayload,
} from './systemPowerplayUpdated.js'

type PublishTarget = {
  channel: string
  payload: SystemPowerplayUpdatedPayload
}

export const buildSystemPowerplayPublishTargets = (args: {
  outboxPayload: unknown
  createdAt: Date
  powerIds: string[]
}): PublishTarget[] => {
  const targets: PublishTarget[] = []

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
