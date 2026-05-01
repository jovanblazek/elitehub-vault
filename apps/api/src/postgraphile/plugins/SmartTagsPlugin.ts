import { jsonPgSmartTags } from 'postgraphile/utils'

export const SmartTagsPlugin = jsonPgSmartTags({
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
      'factionStates.influence': {
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
    },
  },
})
