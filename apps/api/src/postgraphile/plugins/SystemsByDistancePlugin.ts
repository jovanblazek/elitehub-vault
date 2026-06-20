import { pgSelect, sql, TYPES } from 'postgraphile/@dataplan/pg'
import { connection } from 'postgraphile/grafast'
import { extendSchema, gql } from 'postgraphile/utils'

export const SystemsByDistancePlugin = extendSchema((build) => {
  const systemsResource = build.pgResources.systems

  if (!systemsResource) {
    throw new Error("Missing pg resource 'systems'.")
  }

  const systemConnectionTypeName = build.inflection.tableConnectionType(systemsResource.codec)

  return {
    typeDefs: gql`
      extend type Query {
        systemsByDistance(referenceSystemId: UUID!): ${systemConnectionTypeName}
      }
    `,
    objects: {
      Query: {
        plans: {
          systemsByDistance: {
            scope: {
              isPgFieldConnection: true,
              pgFieldResource: systemsResource,
            },
            plan($root, args) {
              const $systems = pgSelect({
                resource: systemsResource,
                identifiers: [],
                name: 'systems_by_distance',
              })
              const referenceSystemId = $systems.placeholder(
                args.getRaw('referenceSystemId'),
                TYPES.uuid
              )

              $systems.where(sql`
                exists (
                  select 1
                  from public.systems as reference_system
                  where reference_system.id = ${referenceSystemId}
                )
              `)
              $systems.orderBy({
                attribute: 'position',
                callback: (attributeExpression) => [
                  sql`(
                    ${attributeExpression} <-> (
                      select reference_system.position
                      from public.systems as reference_system
                      where reference_system.id = ${referenceSystemId}
                    )
                  )`,
                  TYPES.float,
                  false,
                ],
                direction: 'ASC',
              })

              return connection($systems as never)
            },
          },
        },
      },
    },
  }
})
