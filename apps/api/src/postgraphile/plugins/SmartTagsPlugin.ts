import { jsonPgSmartTags } from 'postgraphile/utils'

export const smartTagsConfig: Parameters<typeof jsonPgSmartTags>[0] = {
  version: 1,
  config: {
    class: {
      __drizzle_migrations__: {
        tags: {
          // Disable everything for the __drizzle_migrations__ table
          behavior: '-*',
        },
      },
      systemPowerplayPowers: {
        tags: {
          // Disable direct queries to the systemPowerplayPowers table
          behavior: '-query:resource:single -query:resource:connection -resource:select',
        },
      },
      apiKeys: {
        tags: {
          // Disable everything for the apiKeys table
          behavior: '-*',
        },
      },
      eventOutbox: {
        tags: {
          // Disable everything for the internal event outbox table
          behavior: '-*',
        },
      },
      systemFactionControlThreats: {
        tags: {
          // Disable everything for the internal system faction control threats table
          behavior: '-*',
        },
      },
    },
    attribute: {
      'systems.government': {
        tags: {
          behavior: '+filterBy',
        },
      },
      'systems.allegiance': {
        tags: {
          behavior: '+filterBy',
        },
      },
      'systems.economy': {
        tags: {
          behavior: '+filterBy',
        },
      },
      'systems.security': {
        tags: {
          behavior: '+filterBy',
        },
      },
      'systems.powerplayState': {
        tags: {
          behavior: '+filterBy',
        },
      },
      'factions.government': {
        tags: {
          behavior: '+filterBy',
        },
      },
      'factions.allegiance': {
        tags: {
          behavior: '+filterBy',
        },
      },
      'stations.government': {
        tags: {
          behavior: '+filterBy',
        },
      },
      'stations.stationType': {
        tags: {
          behavior: '+filterBy',
        },
      },
      'stations.allegiance': {
        tags: {
          behavior: '+filterBy',
        },
      },
      'stations.economy': {
        tags: {
          behavior: '+filterBy',
        },
      },
      'factionStates.influence': {
        tags: {
          behavior: '+orderBy',
        },
      },
      'factionStates.updatedAt': {
        tags: {
          behavior: '+orderBy',
        },
      },
      'factionConflicts.updatedAt': {
        tags: {
          behavior: '+orderBy',
        },
      },
    },
    procedure: {
      refresh_system_faction_control_threat: {
        tags: {
          // Disable GraphQL exposure for the internal control threat refresh routine
          behavior: '-*',
        },
      },
      emit_faction_conflict_lifecycle_event: {
        tags: {
          // Disable GraphQL exposure for the internal conflict lifecycle emitter
          behavior: '-*',
        },
      },
      emit_faction_state_lifecycle_events: {
        tags: {
          // Disable GraphQL exposure for the internal state lifecycle emitter
          behavior: '-*',
        },
      },
      system_distance: {
        tags: {
          fieldName: 'distance',
        },
      },
    },
  },
} as const

export const SmartTagsPlugin = jsonPgSmartTags(smartTagsConfig)
