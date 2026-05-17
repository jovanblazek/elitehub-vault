import { connection } from 'postgraphile/grafast'
import { extendSchema, gql } from 'postgraphile/utils'

export const StationsByDistancePlugin = extendSchema((build) => {
  const stationsByDistanceResource = build.pgResources.stations_by_distance

  if (!stationsByDistanceResource) {
    throw new Error("Missing pg resource 'stations_by_distance'; run the latest database migrations.")
  }

  const stationConnectionTypeName = build.inflection.tableConnectionType(
    stationsByDistanceResource.codec
  )
  const resourceParameters = stationsByDistanceResource.parameters

  if (!resourceParameters?.length) {
    throw new Error("Resource 'stations_by_distance' is missing parameters.")
  }

  const referenceSystemParameter = resourceParameters[0]

  if (!referenceSystemParameter?.codec) {
    throw new Error("Resource 'stations_by_distance' is missing the reference_system_id parameter codec.")
  }

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
              pgFieldResource: stationsByDistanceResource,
            },
            plan($root, args) {
              const $select = stationsByDistanceResource.execute([
                {
                  name: referenceSystemParameter.name ?? undefined,
                  pgCodec: referenceSystemParameter.codec,
                  step: args.getRaw('referenceSystemId'),
                },
              ])

              return connection($select as never)
            },
          },
        },
      },
    },
  }
})
