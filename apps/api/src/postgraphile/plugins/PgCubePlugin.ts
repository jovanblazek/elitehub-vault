import { TYPES, listOfCodec } from 'postgraphile/@dataplan/pg'

/**
 * Plugin to convert PostgreSQL cube type to GraphQL Float array
 */
export const PgCubePlugin: GraphileConfig.Plugin = {
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
