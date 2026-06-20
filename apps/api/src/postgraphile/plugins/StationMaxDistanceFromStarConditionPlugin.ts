import { addPgTableCondition } from 'postgraphile/utils'
import { sql } from 'postgraphile/@dataplan/pg'

type SqlFragment = ReturnType<typeof sql>
type SqlIdentifier = ReturnType<typeof sql.identifier>

type ConditionLike = {
  alias: SqlIdentifier
  where: (fragment: SqlFragment) => void
}

export const applyMaxDistanceFromStarCondition = (
  condition: ConditionLike,
  maxDistanceFromStar: number
) => {
  condition.where(
    sql`${condition.alias}.${sql.identifier('distanceFromStar')} <= ${sql.value(maxDistanceFromStar)}`
  )
}

export const applyMaxDistanceFromStarInput = (
  condition: ConditionLike,
  maxDistanceFromStar: number | null | undefined
) => {
  if (maxDistanceFromStar == null) {
    return
  }

  applyMaxDistanceFromStarCondition(condition, maxDistanceFromStar)
}

export const StationMaxDistanceFromStarConditionPlugin = addPgTableCondition(
  {
    schemaName: 'public',
    tableName: 'stations',
  },
  'maxDistanceFromStar',
  (build) => ({
    description: 'Filters stations to those at or below the provided distance from the arrival star.',
    type: build.graphql.GraphQLFloat,
    apply(condition, value) {
      applyMaxDistanceFromStarInput(condition as ConditionLike, value as number | null)
    },
  })
)
