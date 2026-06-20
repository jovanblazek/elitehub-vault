import { pgSelect, sql, TYPES } from 'postgraphile/@dataplan/pg'
import { connection } from 'postgraphile/grafast'
import { extendSchema, gql } from 'postgraphile/utils'

export const FactionStatesByDistancePlugin = extendSchema((build) => {
  const factionStatesResource = build.pgResources.factionStates

  if (!factionStatesResource) {
    throw new Error("Missing pg resource 'factionStates'.")
  }

  const factionStateConnectionTypeName = build.inflection.tableConnectionType(
    factionStatesResource.codec
  )

  return {
    typeDefs: gql`
      extend type Query {
        factionStatesByDistance(referenceSystemId: UUID!): ${factionStateConnectionTypeName}
      }
    `,
    objects: {
      Query: {
        plans: {
          factionStatesByDistance: {
            scope: {
              isPgFieldConnection: true,
              pgFieldResource: factionStatesResource,
            },
            plan($root, args) {
              const $factionStates = pgSelect({
                resource: factionStatesResource,
                identifiers: [],
                from: {
                  callback: ($select) => {
                    const referenceSystemId = $select.placeholder(
                      args.getRaw('referenceSystemId'),
                      TYPES.uuid
                    )

                    return sql`(
                      select
                        faction_state.*,
                        nearby_system.position <-> (
                          select reference_system.position
                          from public.systems as reference_system
                          where reference_system.id = ${referenceSystemId}
                        ) as __distance
                      from public.systems as nearby_system
                      join lateral (
                        select fs.*
                        from public."factionStates" as fs
                        where fs."systemId" = nearby_system.id
                      ) as faction_state
                        on true
                      where exists (
                        select 1
                        from public.systems as reference_system
                        where reference_system.id = ${referenceSystemId}
                      )
                    )`
                  },
                },
                name: 'faction_states_by_distance',
              })

              $factionStates.orderBy((innerSql) => ({
                fragment: innerSql`${$factionStates.alias}.__distance`,
                codec: TYPES.float,
                direction: 'ASC',
                nullable: false,
              }))

              return connection($factionStates as never)
            },
          },
        },
      },
    },
  }
})
