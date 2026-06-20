import { addPgTableCondition } from 'postgraphile/utils'
import { sql } from 'postgraphile/@dataplan/pg'

export type LandingPadSize = 'SMALL' | 'MEDIUM' | 'LARGE'

type LandingPadColumn = 'landingPadsSmall' | 'landingPadsMedium' | 'landingPadsLarge'

type ConditionLike = {
  alias: ReturnType<typeof sql.identifier>
  where: (fragment: ReturnType<typeof sql>) => void
}

export const getLandingPadColumnsForMinSize = (size: LandingPadSize): Array<LandingPadColumn> => {
  switch (size) {
    case 'SMALL':
      return ['landingPadsSmall', 'landingPadsMedium', 'landingPadsLarge']
    case 'MEDIUM':
      return ['landingPadsMedium', 'landingPadsLarge']
    case 'LARGE':
      return ['landingPadsLarge']
  }
}

export const applyMinLandingPadSizeCondition = (condition: ConditionLike, size: LandingPadSize) => {
  const columns = getLandingPadColumnsForMinSize(size)
  const checks = columns.map((column) => sql`${condition.alias}.${sql.identifier(column)} > 0`)

  condition.where(sql`(${sql.join(checks, ' or ')})`)
}

export const applyMinLandingPadSizeInput = (
  condition: ConditionLike,
  size: LandingPadSize | null | undefined
) => {
  if (size == null) {
    return
  }

  applyMinLandingPadSizeCondition(condition, size)
}

export const StationMinLandingPadSizeConditionPlugin = addPgTableCondition(
  {
    schemaName: 'public',
    tableName: 'stations',
  },
  'minLandingPadSize',
  (build) => {
    const { GraphQLEnumType } = build.graphql

    return {
      description:
        'Filters stations to those with at least one landing pad that can accommodate the selected ship size.',
      type: new GraphQLEnumType({
        name: 'LandingPadSize',
        values: {
          SMALL: {
            value: 'SMALL',
            description: 'Stations with at least one small, medium, or large landing pad.',
          },
          MEDIUM: {
            value: 'MEDIUM',
            description: 'Stations with at least one medium or large landing pad.',
          },
          LARGE: {
            value: 'LARGE',
            description: 'Stations with at least one large landing pad.',
          },
        },
      }),
      apply(condition, value) {
        applyMinLandingPadSizeInput(condition as ConditionLike, value as LandingPadSize | null)
      },
    }
  }
)
