import { addPgTableCondition } from 'postgraphile/utils'
import { sql } from 'postgraphile/@dataplan/pg'
import type { PowerplayState } from '@elitehub/db/schema'

type SqlFragment = ReturnType<typeof sql>
type SqlIdentifier = ReturnType<typeof sql.identifier>

type ConditionLike = {
  alias: SqlIdentifier
  where: (fragment: SqlFragment) => void
}

export const applySystemPowerplayStateCondition = (
  condition: ConditionLike,
  powerplayStates: readonly PowerplayState[],
  sqlType: SqlFragment
) => {
  condition.where(
    sql`${condition.alias}.${sql.identifier('powerplayState')} = ANY(${sql.value([...powerplayStates])}::${sqlType}[])`
  )
}

export const applySystemPowerplayStateInput = (
  condition: ConditionLike,
  powerplayStates: readonly PowerplayState[] | null | undefined,
  sqlType: SqlFragment
) => {
  if (powerplayStates == null) {
    return
  }

  applySystemPowerplayStateCondition(condition, powerplayStates, sqlType)
}

export const SystemPowerplayStateConditionPlugin = addPgTableCondition(
  {
    schemaName: 'public',
    tableName: 'systems',
  },
  'powerplayState',
  (build) => {
    const systemsResource = build.pgResources.systems

    if (!systemsResource) {
      throw new Error("Missing pg resource 'systems'.")
    }

    const powerplayStateCodec = systemsResource.codec.attributes.powerplayState?.codec
    const powerplayState = powerplayStateCodec
      ? build.getGraphQLTypeByPgCodec(powerplayStateCodec, 'input')
      : null

    if (!powerplayStateCodec || !powerplayState || !build.graphql.isEnumType(powerplayState)) {
      throw new Error('Missing GraphQL input type for systems.powerplayState.')
    }

    return {
      description: 'Matches systems whose powerplayState is any of the provided powerplay states.',
      type: new build.graphql.GraphQLList(new build.graphql.GraphQLNonNull(powerplayState)),
      apply(condition, value) {
        applySystemPowerplayStateInput(
          condition as ConditionLike,
          value as readonly PowerplayState[] | null | undefined,
          powerplayStateCodec.sqlType
        )
      },
    }
  }
)
