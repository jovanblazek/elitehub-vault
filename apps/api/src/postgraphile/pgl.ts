import { postgraphile } from 'postgraphile'
import { makePgService } from 'postgraphile/adaptors/pg'
import { PostGraphileAmberPreset } from 'postgraphile/presets/amber'
import { PgSimplifyInflectionPreset } from '@graphile/simplify-inflection'
import { ReasonableLimitsPlugin } from '@haathie/postgraphile-reasonable-limits'
import { ArmorPlugin } from './plugins/ArmorPlugin.js'
import { SmartTagsPlugin } from './plugins/SmartTagsPlugin.js'
import { PgCubePlugin } from './plugins/PgCubePlugin.js'
import { IdToNodeIdPlugin } from './plugins/IdToNodeIdPlugin.js'
import * as Sentry from '@sentry/node'
import { defaultMaskError } from 'postgraphile/grafserv'
import { OTELPlugin } from '@haathie/postgraphile-otel'

const IS_DEVELOPMENT = process.env.NODE_ENV === 'development'

const PGL_Preset: GraphileConfig.Preset = {
  extends: [PostGraphileAmberPreset, PgSimplifyInflectionPreset],
  plugins: [
    OTELPlugin,
    ArmorPlugin,
    PgCubePlugin,
    IdToNodeIdPlugin,
    SmartTagsPlugin,
    ReasonableLimitsPlugin,
  ],
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
      } as any
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
