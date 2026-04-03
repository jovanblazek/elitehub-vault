import type { EDDNJournalMessage } from './types.js'

export const EDDN_URL = 'tcp://eddn.edcd.io:9500'
export const EDDN_JOURNAL_EVENT_SCHEMA = 'https://eddn.edcd.io/schemas/journal/1'
export const EDDN_MAJOR_GAME_VERSION = '4'
export const SUPPORTED_EDDN_SOFTWARE_PREFIXES = [
  'E:D Market Connector',
  'EDDiscovery',
  'EDO Materials Helper',
  'EDDI',
  'EDDLite',
] as const
export const SUPPORTED_EDDN_EVENTS = ['FSDJump', 'Location', 'Docked'] as const
export const EDDN_IGNORE_OLDER_THAN_MS = 10 * 60 * 1000

const supportedEvents = new Set<string>(SUPPORTED_EDDN_EVENTS)

export const isSupportedEddnMessage = (
  message: EDDNJournalMessage,
  now = Date.now()
): boolean => {
  return (
    message.$schemaRef === EDDN_JOURNAL_EVENT_SCHEMA &&
    message.header.gameversion?.startsWith(EDDN_MAJOR_GAME_VERSION) === true &&
    SUPPORTED_EDDN_SOFTWARE_PREFIXES.some((prefix) =>
      message.header.softwareName.startsWith(prefix)
    ) &&
    supportedEvents.has(message.message.event) &&
    new Date(message.message.timestamp).getTime() >= now - EDDN_IGNORE_OLDER_THAN_MS
  )
}
