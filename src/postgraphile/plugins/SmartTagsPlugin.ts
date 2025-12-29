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
    },
  },
})
