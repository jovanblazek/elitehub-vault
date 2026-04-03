export const RealtimeEventChannels = {} as const

export type RealtimeEventType = keyof typeof RealtimeEventChannels

export const getRealtimeChannelForEventType = (eventType: string): string | null =>
  RealtimeEventChannels[eventType as RealtimeEventType] ?? null
