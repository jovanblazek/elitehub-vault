import assert from 'node:assert/strict'
import { sql } from 'postgraphile/@dataplan/pg'
import { test } from 'vitest'
import {
  SystemMaxPopulationConditionPlugin,
  SystemMinPopulationConditionPlugin,
  applyMaxPopulationInput,
  applyMinPopulationInput,
} from './SystemPopulationConditionPlugin.js'

type MockCondition = {
  alias: ReturnType<typeof sql.identifier>
  where: (fragment: ReturnType<typeof sql>) => void
}

const createCondition = (fragments: Array<ReturnType<typeof sql>>): MockCondition => ({
  alias: sql.identifier('system'),
  where(fragment) {
    fragments.push(fragment)
  },
})

const createPopulationConditionBuild = () => {
  const graphQLIntType = { name: 'Int' }
  const bigIntType = { name: 'BigInt' }
  const build = {
    _pluginMeta: {},
    graphql: {
      GraphQLInt: graphQLIntType,
    },
    inflection: {
      builtin(name: string) {
        return name
      },
    },
    getInputTypeByName(typeName: string) {
      assert.equal(typeName, 'BigInt')
      return bigIntType
    },
    extend<TBase extends object, TExtra extends object>(base: TBase, extra: TExtra) {
      return { ...base, ...extra }
    },
  }

  return {
    build,
    bigIntType,
    graphQLIntType,
  }
}

const getPopulationConditionFieldType = (
  plugin: typeof SystemMinPopulationConditionPlugin | typeof SystemMaxPopulationConditionPlugin
) => {
  const { build, bigIntType } = createPopulationConditionBuild()
  const schemaHooks = plugin.schema?.hooks as {
    build: (build: unknown) => unknown
    GraphQLInputObjectType_fields: (
      fields: Record<string, unknown>,
      build: unknown,
      context: unknown
    ) => Record<string, { type: unknown }>
  }

  schemaHooks.build(build)

  const fields = schemaHooks.GraphQLInputObjectType_fields(
    {},
    build as never,
    {
      scope: {
        isPgCondition: true,
        pgCodec: {
          attributes: { population: true },
          extensions: {
            pg: {
              serviceName: 'main',
              schemaName: 'public',
              name: 'systems',
            },
          },
        },
      },
      fieldWithHooks(
        _scope: unknown,
        spec: { type: unknown } | ((context: unknown) => { type: unknown })
      ) {
        return typeof spec === 'function' ? spec({} as never) : spec
      },
    } as never
  )

  return {
    type: Object.values(fields)[0]?.type,
    bigIntType,
  }
}

test('min population filters systems at or above the inclusive threshold', () => {
  const fragments: Array<ReturnType<typeof sql>> = []

  applyMinPopulationInput(createCondition(fragments), 5000000)

  assert.equal(fragments.length, 1)

  const compiled = sql.compile(fragments[0])
  assert.equal(compiled.text, '"system"."population" >= $1')
  assert.deepEqual(compiled.values, [5000000])
})

test('max population filters systems at or below the inclusive threshold', () => {
  const fragments: Array<ReturnType<typeof sql>> = []

  applyMaxPopulationInput(createCondition(fragments), 9000000)

  assert.equal(fragments.length, 1)

  const compiled = sql.compile(fragments[0])
  assert.equal(compiled.text, '"system"."population" <= $1')
  assert.deepEqual(compiled.values, [9000000])
})

test('min population condition exposes the built-in BigInt input type', () => {
  const { type, bigIntType } = getPopulationConditionFieldType(SystemMinPopulationConditionPlugin)

  assert.equal(type, bigIntType)
})

test('max population condition exposes the built-in BigInt input type', () => {
  const { type, bigIntType } = getPopulationConditionFieldType(SystemMaxPopulationConditionPlugin)

  assert.equal(type, bigIntType)
})
