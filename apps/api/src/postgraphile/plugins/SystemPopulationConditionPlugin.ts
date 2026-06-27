import { addPgTableCondition } from 'postgraphile/utils'
import { sql } from 'postgraphile/@dataplan/pg'

type SqlFragment = ReturnType<typeof sql>
type SqlIdentifier = ReturnType<typeof sql.identifier>

type ConditionLike = {
  alias: SqlIdentifier
  where: (fragment: SqlFragment) => void
}

export const applyMinPopulationCondition = (
  condition: ConditionLike,
  minPopulation: number | string
) => {
  condition.where(
    sql`${condition.alias}.${sql.identifier('population')} >= ${sql.value(minPopulation)}`
  )
}

export const applyMinPopulationInput = (
  condition: ConditionLike,
  minPopulation: number | string | null | undefined
) => {
  if (minPopulation == null) {
    return
  }

  applyMinPopulationCondition(condition, minPopulation)
}

export const applyMaxPopulationCondition = (
  condition: ConditionLike,
  maxPopulation: number | string
) => {
  condition.where(
    sql`${condition.alias}.${sql.identifier('population')} <= ${sql.value(maxPopulation)}`
  )
}

export const applyMaxPopulationInput = (
  condition: ConditionLike,
  maxPopulation: number | string | null | undefined
) => {
  if (maxPopulation == null) {
    return
  }

  applyMaxPopulationCondition(condition, maxPopulation)
}

export const SystemMinPopulationConditionPlugin = addPgTableCondition(
  {
    schemaName: 'public',
    tableName: 'systems',
  },
  'minPopulation',
  (build) => ({
    description: 'Matches systems whose population is at or above the provided value.',
    type: build.getInputTypeByName(build.inflection.builtin('BigInt')),
    apply(condition, value) {
      applyMinPopulationInput(
        condition as ConditionLike,
        value as number | string | null | undefined
      )
    },
  })
)

export const SystemMaxPopulationConditionPlugin = addPgTableCondition(
  {
    schemaName: 'public',
    tableName: 'systems',
  },
  'maxPopulation',
  (build) => ({
    description: 'Matches systems whose population is at or below the provided value.',
    type: build.getInputTypeByName(build.inflection.builtin('BigInt')),
    apply(condition, value) {
      applyMaxPopulationInput(
        condition as ConditionLike,
        value as number | string | null | undefined
      )
    },
  })
)
