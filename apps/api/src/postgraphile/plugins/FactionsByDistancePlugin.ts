import { pgSelect, sql, TYPES } from 'postgraphile/@dataplan/pg'
import { connection } from 'postgraphile/grafast'
import { extendSchema, gql } from 'postgraphile/utils'

const RANKED_SYSTEM_LIMIT = 5_000

export const FactionsByDistancePlugin = extendSchema((build) => {
  const factionsResource = build.pgResources.factions

  if (!factionsResource) {
    throw new Error("Missing pg resource 'factions'.")
  }

  const factionConnectionTypeName = build.inflection.tableConnectionType(factionsResource.codec)

  return {
    typeDefs: gql`
      extend type Query {
        factionsByDistance(referenceSystemId: UUID!): ${factionConnectionTypeName}
      }
    `,
    objects: {
      Query: {
        plans: {
          factionsByDistance: {
            scope: {
              isPgFieldConnection: true,
              pgFieldResource: factionsResource,
            },
            plan($root, args) {
              const $factions = pgSelect({
                resource: factionsResource,
                identifiers: [],
                from: {
                  callback: ($select) => {
                    const referenceSystemId = $select.placeholder(
                      args.getRaw('referenceSystemId'),
                      TYPES.uuid
                    )
                    const rankedSystemLimit = sql.literal(String(RANKED_SYSTEM_LIMIT))

                    return sql`(
                      with ranked_systems as materialized (
                        select
                          nearby_system.id,
                          nearby_system.position <-> (
                            select reference_system.position
                            from public.systems as reference_system
                            where reference_system.id = ${referenceSystemId}
                          ) as __distance
                        from public.systems as nearby_system
                        where exists (
                          select 1
                          from public.systems as reference_system
                          where reference_system.id = ${referenceSystemId}
                        )
                        order by nearby_system.position <-> (
                          select reference_system.position
                          from public.systems as reference_system
                          where reference_system.id = ${referenceSystemId}
                        ), nearby_system.id
                        limit ${rankedSystemLimit}
                      )
                      select ranked_factions.*
                      from (
                        select distinct on (faction.id)
                          faction.*,
                          ranked_systems.__distance,
                          ranked_systems.id as __nearby_system_id
                        from ranked_systems
                        join public."systemFactions" as system_faction
                          on system_faction."systemId" = ranked_systems.id
                        join public.factions as faction
                          on faction.id = system_faction."factionId"
                        order by faction.id, ranked_systems.__distance, ranked_systems.id
                      ) as ranked_factions
                    )`
                  },
                },
                name: 'factions_by_distance',
              })

              $factions.orderBy((innerSql) => ({
                fragment: innerSql`${$factions.alias}.__distance`,
                codec: TYPES.float,
                direction: 'ASC',
                nullable: false,
              }))

              return connection($factions as never)
            },
          },
        },
      },
    },
  }
})
