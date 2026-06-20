import { addPgTableCondition } from 'postgraphile/utils'
import { sql, sqlValueWithCodec } from 'postgraphile/@dataplan/pg'

type FactionStateArrayColumn = 'pendingStates' | 'activeStates' | 'recoveringStates'

export type FactionStateArrayFilterMode = 'any' | 'all'

type SqlFragment = ReturnType<typeof sql>
type SqlIdentifier = ReturnType<typeof sql.identifier>

type ConditionLike = {
  alias: SqlIdentifier
  where: (fragment: SqlFragment) => void
}

const FILTER_MODES = [
  {
    fieldSuffix: 'Any',
    mode: 'any',
    operator: '&&',
    description: 'Matches rows where at least one of the provided states is present.',
  },
  {
    fieldSuffix: 'All',
    mode: 'all',
    operator: '@>',
    description: 'Matches rows where all of the provided states are present.',
  },
] as const

const FILTER_COLUMNS: ReadonlyArray<FactionStateArrayColumn> = [
  'pendingStates',
  'activeStates',
  'recoveringStates',
] as const

export const applyFactionStateArrayCondition = (
  $condition: ConditionLike,
  column: FactionStateArrayColumn,
  mode: FactionStateArrayFilterMode,
  states: readonly string[],
  codec?: unknown
) => {
  const operator = mode === 'any' ? sql`&&` : sql`@>`
  const placeholder =
    codec === undefined ? sql.value([...states]) : sqlValueWithCodec(states, codec as never)

  $condition.where(sql`${$condition.alias}.${sql.identifier(column)} ${operator} ${placeholder}`)
}

export const FactionStateConditionPlugins = FILTER_COLUMNS.flatMap((column) =>
  FILTER_MODES.map(({ fieldSuffix, mode, description }) =>
    addPgTableCondition(
      { schemaName: 'public', tableName: 'factionStates' },
      `${column}${fieldSuffix}`,
      (build) => {
        const factionStatesResource = build.pgResources.factionStates

        if (!factionStatesResource) {
          throw new Error("Missing pg resource 'factionStates'.")
        }

        const arrayCodec = factionStatesResource.codec.attributes[column]?.codec
        const itemCodec = arrayCodec?.arrayOfCodec
        const itemType = itemCodec ? build.getGraphQLTypeByPgCodec(itemCodec, 'input') : null

        if (!arrayCodec || !itemType) {
          throw new Error(`Missing GraphQL input type for factionStates.${column}.`)
        }

        return {
          description,
          type: new build.graphql.GraphQLList(
            new build.graphql.GraphQLNonNull(itemType as never)
          ) as never,
          apply($condition: ConditionLike, states: readonly string[] | null | undefined) {
            if (states == null) {
              return
            }

            applyFactionStateArrayCondition($condition, column, mode, states, arrayCodec)
          },
        }
      }
    )
  )
)
