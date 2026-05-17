import { TYPES } from 'postgraphile/@dataplan/pg'
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
              const $stations = stationsResource.find()
              const referenceSystemId = $stations.placeholder(args.getRaw('referenceSystemId'), TYPES.uuid)

              $stations.where(
                (sql) => sql`exists(
                  select 1
                  from public.systems as reference_system
                  where reference_system.id = ${referenceSystemId}
                )`
              )
              $stations.orderBy((sql) => ({
                fragment: sql`(
                  select cube_distance(station_system.position, reference_system.position)
                  from public.systems as station_system
                  inner join public.systems as reference_system
                    on reference_system.id = ${referenceSystemId}
                  where station_system.id = ${$stations.alias}."systemId"
                )`,
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
