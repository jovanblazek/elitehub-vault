import assert from 'node:assert/strict'
import { sql } from 'drizzle-orm'
import { test } from 'vitest'
import { db } from '../../db/db.js'

type ExplainNode = {
  'Node Type'?: string
  'Index Name'?: string
  Plans?: ExplainNode[]
}

type ExplainPlan = {
  Plan: ExplainNode
  'Planning Time': number
  'Execution Time': number
  'Shared Hit Blocks'?: number
  'Shared Read Blocks'?: number
}

type FactionStateIdRow = {
  id: string
}

const RESULT_LIMIT = 100

const oldFactionStatesByDistanceQuery = (referenceSystemId: string) => sql<FactionStateIdRow>`
  select faction_state.id
  from public."factionStates" as faction_state
  where exists (
    select 1
    from public.systems as reference_system
    where reference_system.id = ${referenceSystemId}::uuid
  )
  order by (
    select faction_state_system.position <-> reference_system.position
    from public.systems as faction_state_system
    inner join public.systems as reference_system
      on reference_system.id = ${referenceSystemId}::uuid
    where faction_state_system.id = faction_state."systemId"
  ) asc,
  faction_state.id asc
  limit ${RESULT_LIMIT}
`

const systemFirstFactionStatesByDistanceQuery = (referenceSystemId: string) => sql<FactionStateIdRow>`
  with reference_system as (
    select system.position
    from public.systems as system
    where system.id = ${referenceSystemId}::uuid
  )
  select faction_state.id
  from reference_system
  inner join public.systems as nearby_system
    on true
  inner join lateral (
    select fs.id
    from public."factionStates" as fs
    where fs."systemId" = nearby_system.id
  ) as faction_state
    on true
  order by nearby_system.position <-> reference_system.position, faction_state.id
  limit ${RESULT_LIMIT}
`

const systemFirstScalarReferenceFactionStatesByDistanceQuery = (referenceSystemId: string) => sql<
  FactionStateIdRow
>`
  select faction_state.id
  from public.systems as nearby_system
  inner join lateral (
    select fs.id
    from public."factionStates" as fs
    where fs."systemId" = nearby_system.id
  ) as faction_state
    on true
  where exists (
    select 1
    from public.systems as reference_system
    where reference_system.id = ${referenceSystemId}::uuid
  )
  order by nearby_system.position <-> (
    select reference_system.position
    from public.systems as reference_system
    where reference_system.id = ${referenceSystemId}::uuid
  ), faction_state.id
  limit ${RESULT_LIMIT}
`

const findNode = (
  planNode: ExplainNode,
  predicate: (node: ExplainNode) => boolean
): ExplainNode | null => {
  if (predicate(planNode)) {
    return planNode
  }

  for (const child of planNode.Plans ?? []) {
    const match = findNode(child, predicate)

    if (match) {
      return match
    }
  }

  return null
}

const extractExplainPlan = async (
  query: ReturnType<typeof oldFactionStatesByDistanceQuery>
): Promise<ExplainPlan> => {
  const result = await db.execute(sql`
    explain (analyze, buffers, format json)
    ${query}
  `)

  const rows = result.rows as Array<{ 'QUERY PLAN': ExplainPlan[] }>
  const explainPlan = rows[0]?.['QUERY PLAN']?.[0]

  assert.ok(explainPlan, 'expected EXPLAIN output')

  return explainPlan
}

test('faction states by distance benchmark compares faction-state-first and system-first SQL shapes', async () => {
  const referenceSystemResult = await db.execute(sql<{ id: string }>`
    select system.id
    from public.systems as system
    inner join public."factionStates" as faction_state
      on faction_state."systemId" = system.id
    group by system.id
    order by count(*) desc, system.id asc
    limit 1
  `)

  const referenceSystemRows = referenceSystemResult.rows as Array<{ id: string }>
  const referenceSystemId = referenceSystemRows[0]?.id

  assert.ok(referenceSystemId, 'expected at least one system with faction states in the database')

  const oldQuery = oldFactionStatesByDistanceQuery(referenceSystemId)
  const systemFirstQuery = systemFirstFactionStatesByDistanceQuery(referenceSystemId)
  const systemFirstScalarReferenceQuery =
    systemFirstScalarReferenceFactionStatesByDistanceQuery(referenceSystemId)

  const [
    oldRowsResult,
    systemFirstRowsResult,
    systemFirstScalarReferenceRowsResult,
    oldExplainPlan,
    systemFirstExplainPlan,
    systemFirstScalarReferenceExplainPlan,
  ] = await Promise.all([
    db.execute(oldQuery),
    db.execute(systemFirstQuery),
    db.execute(systemFirstScalarReferenceQuery),
    extractExplainPlan(oldQuery),
    extractExplainPlan(systemFirstQuery),
    extractExplainPlan(systemFirstScalarReferenceQuery),
  ])

  const oldFactionStateIds = (oldRowsResult.rows as FactionStateIdRow[]).map((row) => row.id)
  const systemFirstFactionStateIds = (systemFirstRowsResult.rows as FactionStateIdRow[]).map(
    (row) => row.id
  )
  const systemFirstScalarReferenceFactionStateIds = (
    systemFirstScalarReferenceRowsResult.rows as FactionStateIdRow[]
  ).map((row) => row.id)

  assert.deepEqual(systemFirstFactionStateIds, oldFactionStateIds)
  assert.deepEqual(systemFirstScalarReferenceFactionStateIds, oldFactionStateIds)

  const oldPlanUsesGistIndex = Boolean(
    findNode(oldExplainPlan.Plan, (node) => node['Index Name'] === 'systems_position_index')
  )
  const systemFirstPlanUsesGistIndex = Boolean(
    findNode(systemFirstExplainPlan.Plan, (node) => node['Index Name'] === 'systems_position_index')
  )
  const systemFirstScalarReferencePlanUsesGistIndex = Boolean(
    findNode(
      systemFirstScalarReferenceExplainPlan.Plan,
      (node) => node['Index Name'] === 'systems_position_index'
    )
  )

  console.table([
    {
      query: 'old',
      planningMs: oldExplainPlan['Planning Time'],
      executionMs: oldExplainPlan['Execution Time'],
      sharedHitBlocks: oldExplainPlan['Shared Hit Blocks'] ?? 0,
      sharedReadBlocks: oldExplainPlan['Shared Read Blocks'] ?? 0,
      topNode: oldExplainPlan.Plan['Node Type'] ?? 'unknown',
      usesSystemsPositionGist: oldPlanUsesGistIndex,
    },
    {
      query: 'system-first',
      planningMs: systemFirstExplainPlan['Planning Time'],
      executionMs: systemFirstExplainPlan['Execution Time'],
      sharedHitBlocks: systemFirstExplainPlan['Shared Hit Blocks'] ?? 0,
      sharedReadBlocks: systemFirstExplainPlan['Shared Read Blocks'] ?? 0,
      topNode: systemFirstExplainPlan.Plan['Node Type'] ?? 'unknown',
      usesSystemsPositionGist: systemFirstPlanUsesGistIndex,
    },
    {
      query: 'system-first-scalar-reference',
      planningMs: systemFirstScalarReferenceExplainPlan['Planning Time'],
      executionMs: systemFirstScalarReferenceExplainPlan['Execution Time'],
      sharedHitBlocks: systemFirstScalarReferenceExplainPlan['Shared Hit Blocks'] ?? 0,
      sharedReadBlocks: systemFirstScalarReferenceExplainPlan['Shared Read Blocks'] ?? 0,
      topNode: systemFirstScalarReferenceExplainPlan.Plan['Node Type'] ?? 'unknown',
      usesSystemsPositionGist: systemFirstScalarReferencePlanUsesGistIndex,
    },
  ])

  assert.equal(oldPlanUsesGistIndex, false)
  assert.equal(systemFirstPlanUsesGistIndex, false)
  assert.equal(systemFirstScalarReferencePlanUsesGistIndex, true)
  assert.equal(typeof oldExplainPlan['Execution Time'], 'number')
  assert.equal(typeof systemFirstExplainPlan['Execution Time'], 'number')
  assert.equal(typeof systemFirstScalarReferenceExplainPlan['Execution Time'], 'number')
}, 60_000)
