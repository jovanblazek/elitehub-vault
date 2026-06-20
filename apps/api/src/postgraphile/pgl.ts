import { postgraphile } from 'postgraphile'
import { makePgService } from 'postgraphile/adaptors/pg'
import { PostGraphileAmberPreset } from 'postgraphile/presets/amber'
import { PgSimplifyInflectionPreset } from '@graphile/simplify-inflection'
import { ReasonableLimitsPlugin } from '@haathie/postgraphile-reasonable-limits'
import { ArmorPlugin } from './plugins/ArmorPlugin.js'
import { SmartTagsPlugin } from './plugins/SmartTagsPlugin.js'
import { PgCubePlugin } from './plugins/PgCubePlugin.js'
import { IdToNodeIdPlugin } from './plugins/IdToNodeIdPlugin.js'
import { FactionsByDistancePlugin } from './plugins/FactionsByDistancePlugin.js'
import { FactionStatesByDistancePlugin } from './plugins/FactionStatesByDistancePlugin.js'
import { FactionStateConditionPlugins } from './plugins/FactionStateConditionsPlugin.js'
import { StationMinimumLandingPadSizeConditionPlugin } from './plugins/StationMinimumLandingPadSizeConditionPlugin.js'
import { StationsByDistancePlugin } from './plugins/StationsByDistancePlugin.js'
import { SystemsByDistancePlugin } from './plugins/SystemsByDistancePlugin.js'
import * as Sentry from '@sentry/node'
import { defaultMaskError } from 'postgraphile/grafserv'
import { OTELPlugin } from '@haathie/postgraphile-otel'
import { env } from '../env.js'
import { getApiConsumerFromRequestContext } from './requestContext.js'

const IS_DEVELOPMENT = env.NODE_ENV === 'development'

const PGL_Preset: GraphileConfig.Preset = {
  extends: [PostGraphileAmberPreset, PgSimplifyInflectionPreset],
  plugins: [
    OTELPlugin,
    ArmorPlugin,
    PgCubePlugin,
    IdToNodeIdPlugin,
    SmartTagsPlugin,
    FactionsByDistancePlugin,
    FactionStatesByDistancePlugin,
    ...FactionStateConditionPlugins,
    StationMinimumLandingPadSizeConditionPlugin,
    StationsByDistancePlugin,
    SystemsByDistancePlugin,
    ReasonableLimitsPlugin,
  ],
  pgServices: [
    makePgService({
      connectionString: env.POSTGRES_CONNECTION_STRING,
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
    context(requestContext, args) {
      return {
        ...args.contextValue,
        apiConsumer: getApiConsumerFromRequestContext(requestContext),
      }
    },
  },
  grafserv: {
    maxRequestLength: 16_384, // 16KB
    maskError(error) {
      Sentry.withScope((scope) => {
        scope.setContext('graphql_error', {
          path: error.path?.join('.'),
          message: error.message,
          locations: error.locations,
          extensions: error.extensions,
        })

        scope.setTag('component', 'graphql')
        scope.setTag('error_type', (error.extensions?.code as string) || 'UNKNOWN')

        const originalError = error.originalError || error

        // Only capture server errors (5xx), not client errors (4xx)
        const errorCode = error.extensions?.code as string | undefined
        const isServerError = !errorCode || !errorCode.startsWith('4')

        if (isServerError) {
          Sentry.captureException(originalError, {
            fingerprint: ['graphql', error.path?.join('.') || 'unknown', error.message],
          })
        } else {
          // Log client errors as breadcrumbs for context
          Sentry.addBreadcrumb({
            category: 'graphql',
            message: error.message,
            level: 'warning',
            data: {
              path: error.path?.join('.'),
            },
          })
        }
      })
      return defaultMaskError(error)
    },
  },
  schema: {
    defaultBehavior: '-insert -update -delete',
  },
}

export const pgl = postgraphile(PGL_Preset)
