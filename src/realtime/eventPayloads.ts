import { z } from 'zod'
import {
  buildSystemPowerplayUpdatedPayload,
  type SystemPowerplayUpdatedOutboxPayload,
  SystemPowerplayUpdatedOutboxPayloadSchema,
  type SystemPowerplayUpdatedPayload,
} from './systemPowerplayUpdated.js'

export const GenericPayloadSchema = z.record(z.string(), z.unknown())

export const parseSystemPowerplayUpdatedOutboxPayload = (
  payload: unknown
): SystemPowerplayUpdatedOutboxPayload | null => {
  const parsedPayload = SystemPowerplayUpdatedOutboxPayloadSchema.safeParse(payload)
  if (!parsedPayload.success) {
    return null
  }

  return parsedPayload.data
}

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
