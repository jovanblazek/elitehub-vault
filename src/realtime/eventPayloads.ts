import {
  buildSystemPowerplayUpdatedPayload,
  SYSTEM_POWERPLAY_UPDATED_EVENT,
} from './systemPowerplayUpdated.js'

type GenericPayload = Record<string, unknown>

const asObjectPayload = (value: unknown): GenericPayload | null => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  return value as GenericPayload
}

export const buildPublishedRealtimePayload = (
  eventType: string,
  payload: unknown,
  createdAt: Date
): GenericPayload | null => {
  const objectPayload = asObjectPayload(payload)
  if (!objectPayload) {
    return null
  }

  if (eventType === SYSTEM_POWERPLAY_UPDATED_EVENT) {
    const systemId = objectPayload.systemId
    const changedFields = objectPayload.changedFields
    const source = objectPayload.source
    const metadata = objectPayload.metadata

    if (typeof systemId !== 'string' || !Array.isArray(changedFields)) {
      return null
    }

    return buildSystemPowerplayUpdatedPayload({
      systemId,
      changedFields: changedFields.filter((field): field is string => typeof field === 'string'),
      createdAt,
      source: typeof source === 'string' ? source : undefined,
      metadata: metadata && typeof metadata === 'object' && !Array.isArray(metadata)
        ? (metadata as Record<string, unknown>)
        : undefined,
    })
  }

  return objectPayload
}
