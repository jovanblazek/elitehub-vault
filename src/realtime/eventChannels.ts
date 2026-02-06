import {
  SYSTEM_POWERPLAY_UPDATED_CHANNEL,
  SYSTEM_POWERPLAY_UPDATED_EVENT,
} from './systemPowerplayUpdated.js'

export const RealtimeEventChannels = {
  [SYSTEM_POWERPLAY_UPDATED_EVENT]: SYSTEM_POWERPLAY_UPDATED_CHANNEL,
} as const

export type RealtimeEventType = keyof typeof RealtimeEventChannels

export const getRealtimeChannelForEventType = (eventType: string): string | null =>
  RealtimeEventChannels[eventType as RealtimeEventType] ?? null
