import { pgSelect, sql, TYPES } from 'postgraphile/@dataplan/pg'
import { connection } from 'postgraphile/grafast'
import { extendSchema, gql } from 'postgraphile/utils'

export const StationsByDistancePlugin = extendSchema((build) => {
  const stationsResource = build.pgResources.stations

  if (!stationsResource) {
    throw new Error("Missing pg resource 'stations'.")
  }

  const stationConnectionTypeName = build.inflection.tableConnectionType(stationsResource.codec)

  return {
    typeDefs: gql`
      extend type Query {
        stationsByDistance(referenceSystemId: UUID!): ${stationConnectionTypeName}
      }
    `,
    objects: {
      Query: {
        plans: {
          stationsByDistance: {
            scope: {
              isPgFieldConnection: true,
              pgFieldResource: stationsResource,
            },
            plan($root, args) {
              const $stations = pgSelect({
                resource: stationsResource,
                identifiers: [],
                from: {
                  callback: ($select) => {
                    const referenceSystemId = $select.placeholder(
                      args.getRaw('referenceSystemId'),
                      TYPES.uuid
                    )

                    return sql`(
                      select
                        station.*,
                        nearby_system.position <-> reference_system.position as __distance
                      from public.systems as reference_system
                      join public.systems as nearby_system on true
                      join public.stations as station
                        on station."systemId" = nearby_system.id
                      where reference_system.id = ${referenceSystemId}
                    )`
                  },
                },
                name: 'stations_by_distance',
              })

              $stations.orderBy((sql) => ({
                fragment: sql`${$stations.alias}.__distance`,
                codec: TYPES.float,
                direction: 'ASC',
                nullable: false,
              }))
              $stations.orderBy({
                attribute: 'id',
                direction: 'ASC',
              })
              $stations.setOrderIsUnique()

              return connection($stations as never)
            },
          },
        },
      },
    },
  }
})
