import { postgraphile } from 'postgraphile'
import { makePgService } from 'postgraphile/adaptors/pg'
import { PostGraphileAmberPreset } from 'postgraphile/presets/amber'
import { PgSimplifyInflectionPreset } from '@graphile/simplify-inflection'
import { ReasonableLimitsPlugin } from '@haathie/postgraphile-reasonable-limits'
import { ArmorPlugin } from './plugins/ArmorPlugin.js'
import { SmartTagsPlugin } from './plugins/SmartTagsPlugin.js'
import { PgCubePlugin } from './plugins/PgCubePlugin.js'
import { IdToNodeIdPlugin } from './plugins/IdToNodeIdPlugin.js'

const IS_DEVELOPMENT = process.env.NODE_ENV === 'development'

const PGL_Preset: GraphileConfig.Preset = {
  extends: [PostGraphileAmberPreset, PgSimplifyInflectionPreset],
  plugins: [ArmorPlugin, PgCubePlugin, IdToNodeIdPlugin, SmartTagsPlugin, ReasonableLimitsPlugin],
  pgServices: [
    makePgService({
      connectionString: process.env.POSTGRES_CONNECTION_STRING,
      schemas: ['public'],
    }),
  ],
  grafast: {
    explain: IS_DEVELOPMENT,
    timeouts: {
      /** Planning timeout in ms */
      planning: 500,
      /** Execution timeout in ms */
      execution: 10_000,
    },
    context(requestContext) {
      return {
        apiKey: requestContext.http?.getHeader('x-api-key') as string | undefined,
      }
    },
  },
  grafserv: {
    maxRequestLength: 16_384, // 16KB
  },
  schema: {
    defaultBehavior: '-insert -update -delete',
  },
}

export const pgl = postgraphile(PGL_Preset)
