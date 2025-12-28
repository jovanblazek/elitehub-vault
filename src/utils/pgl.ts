import { postgraphile } from 'postgraphile'
import { TYPES, listOfCodec } from 'postgraphile/@dataplan/pg'

import { makePgService } from 'postgraphile/adaptors/pg'
import { PostGraphileAmberPreset } from 'postgraphile/presets/amber'
import { PgSimplifyInflectionPreset } from "@graphile/simplify-inflection"
import { jsonPgSmartTags } from 'postgraphile/utils'

/**
 * Plugin to rename Postgraphile's default node ID field to 'nodeId' and keep `id` for PostgreSQL's primary key column named `id`
 */
const IdToNodeIdPlugin: GraphileConfig.Plugin = {
  name: 'IdToNodeIdPlugin',
  version: '1.0.0',
  inflection: {
    replace: {
      nodeIdFieldName() {
        return 'nodeId'
      },
      _attributeName(_, __, details) {
        const { codec, attributeName } = details
        const attribute = codec.attributes[attributeName]
        const name = attribute.extensions?.tags?.name || attributeName
        return this.coerceToGraphQLName(name)
      },
    },
  },
}

/**
 * Plugin to convert PostgreSQL cube type to GraphQL Float array
 */
const PgCubePlugin: GraphileConfig.Plugin = {
  name: 'PgCubePlugin',
  version: '1.0.0',
  gather: {
    hooks: {
      async pgCodecs_findPgCodec(_, event) {
        if (event.pgCodec) return
        const { pgType } = event
        if (pgType.typname === 'cube') {
          const list = listOfCodec(TYPES.float)
          event.pgCodec = {
            ...list,
            name: 'cube',
            // identifier: pgType.oid,
            fromPg: (value) => {
              if (typeof value === 'string') {
                return value
                  .replace(/[()]/g, '')
                  .split(',')
                  .map((n) => parseFloat(n.trim()))
              }
              return value
            },
            toPg: (value) => {
              if (Array.isArray(value)) {
                return `(${value.join(',')})`
              }
              return value
            },
          }
        }
      },
    },
  },
}

const SmartTagsPlugin = jsonPgSmartTags({
  version: 1,
  config: {
    class: {
      __drizzle_migrations__: {
        tags: {
          // Disable everything for the __drizzle_migrations__ table
          "behavior": "-*"
        }
      },
      systemPowerplayPowers: {
        tags: {
          // Disable direct queries to the systemPowerplayPowers table
          "behavior": "-query:resource:single -query:resource:connection -resource:select"
        }
      }
    }
  }
})

const PGL_Preset: GraphileConfig.Preset = {
  extends: [PostGraphileAmberPreset, PgSimplifyInflectionPreset],
  plugins: [PgCubePlugin, IdToNodeIdPlugin, SmartTagsPlugin],
  pgServices: [
    makePgService({
      connectionString: process.env.POSTGRES_CONNECTION_STRING,
      schemas: ['public'],
    }),
  ],
  grafast: {
    explain: true,
  },
  schema: {
    defaultBehavior: '-insert -update -delete',
  },
}

export const pgl = postgraphile(PGL_Preset)
