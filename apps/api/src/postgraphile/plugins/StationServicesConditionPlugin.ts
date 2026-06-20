import { addPgTableCondition } from 'postgraphile/utils'
import { sql, sqlValueWithCodec } from 'postgraphile/@dataplan/pg'

type SqlFragment = ReturnType<typeof sql>
type SqlIdentifier = ReturnType<typeof sql.identifier>

type ConditionLike = {
  alias: SqlIdentifier
  where: (fragment: SqlFragment) => void
}

export const applyStationServicesCondition = (
  condition: ConditionLike,
  services: readonly string[],
  codec?: unknown
) => {
  const placeholder =
    codec === undefined ? sql.value([...services]) : sqlValueWithCodec(services, codec as never)

  condition.where(sql`${condition.alias}.${sql.identifier('servicesV2')} @> ${placeholder}`)
}

export const applyStationServicesInput = (
  condition: ConditionLike,
  services: readonly string[] | null | undefined,
  codec?: unknown
) => {
  if (services == null) {
    return
  }

  applyStationServicesCondition(condition, services, codec)
}

export const StationServicesConditionPlugin = addPgTableCondition(
  {
    schemaName: 'public',
    tableName: 'stations',
  },
  'stationServices',
  (build) => {
    const stationsResource = build.pgResources.stations

    if (!stationsResource) {
      throw new Error("Missing pg resource 'stations'.")
    }

    const arrayCodec = stationsResource.codec.attributes.servicesV2?.codec
    const itemCodec = arrayCodec?.arrayOfCodec
    const itemType = itemCodec ? build.getGraphQLTypeByPgCodec(itemCodec, 'input') : null

    if (!arrayCodec || !itemType) {
      throw new Error('Missing GraphQL input type for stations.servicesV2.')
    }

    return {
      description: 'Matches stations whose servicesV2 array contains all provided services.',
      type: new build.graphql.GraphQLList(
        new build.graphql.GraphQLNonNull(itemType as never)
      ) as never,
      apply(condition, value) {
        applyStationServicesInput(
          condition as ConditionLike,
          value as readonly string[] | null | undefined,
          arrayCodec
        )
      },
    }
  }
)
