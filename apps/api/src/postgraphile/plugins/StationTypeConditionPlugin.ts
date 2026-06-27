import { addPgTableCondition } from 'postgraphile/utils'
import { sql } from 'postgraphile/@dataplan/pg'
import type { StationType } from '@elitehub/db/schema'

type SqlFragment = ReturnType<typeof sql>
type SqlIdentifier = ReturnType<typeof sql.identifier>

type ConditionLike = {
  alias: SqlIdentifier
  where: (fragment: SqlFragment) => void
}

export const applyStationTypeCondition = (
  condition: ConditionLike,
  stationTypes: readonly StationType[],
  sqlType: SqlFragment
) => {
  condition.where(
    sql`${condition.alias}.${sql.identifier('stationType')} = ANY(${sql.value([...stationTypes])}::${sqlType}[])`
  )
}

export const applyStationTypeInput = (
  condition: ConditionLike,
  stationTypes: readonly StationType[] | null | undefined,
  sqlType: SqlFragment
) => {
  if (stationTypes == null) {
    return
  }

  applyStationTypeCondition(condition, stationTypes, sqlType)
}

export const StationTypeConditionPlugin = addPgTableCondition(
  {
    schemaName: 'public',
    tableName: 'stations',
  },
  'stationType',
  (build) => {
    const stationsResource = build.pgResources.stations

    if (!stationsResource) {
      throw new Error("Missing pg resource 'stations'.")
    }

    const stationTypeCodec = stationsResource.codec.attributes.stationType?.codec
    const stationType = stationTypeCodec
      ? build.getGraphQLTypeByPgCodec(stationTypeCodec, 'input')
      : null

    if (!stationTypeCodec || !stationType || !build.graphql.isEnumType(stationType)) {
      throw new Error('Missing GraphQL input type for stations.stationType.')
    }

    return {
      description: 'Matches stations whose stationType is any of the provided station types.',
      type: new build.graphql.GraphQLList(new build.graphql.GraphQLNonNull(stationType)),
      apply(condition, value) {
        applyStationTypeInput(
          condition as ConditionLike,
          value as readonly StationType[] | null | undefined,
          stationTypeCodec.sqlType
        )
      },
    }
  }
)
