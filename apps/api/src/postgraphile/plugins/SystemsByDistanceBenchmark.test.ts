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

type SystemIdRow = {
  id: string
}

const RESULT_LIMIT = 100

const cteSystemsByDistanceQuery = (referenceSystemId: string) => sql<SystemIdRow>`
  with reference_system as (
    select system.position
    from public.systems as system
    where system.id = ${referenceSystemId}::uuid
  )
  select nearby_system.id
  from reference_system
  inner join public.systems as nearby_system
    on true
  order by nearby_system.position <-> reference_system.position, nearby_system.id
  limit ${RESULT_LIMIT}
`

const joinedReferenceSystemsByDistanceQuery = (referenceSystemId: string) => sql<SystemIdRow>`
  select nearby_system.id
  from public.systems as nearby_system
  inner join public.systems as reference_system
    on reference_system.id = ${referenceSystemId}::uuid
  order by nearby_system.position <-> reference_system.position, nearby_system.id
  limit ${RESULT_LIMIT}
`

const scalarReferenceSystemsByDistanceQuery = (referenceSystemId: string) => sql<SystemIdRow>`
  select nearby_system.id
  from public.systems as nearby_system
  where exists (
    select 1
    from public.systems as reference_system
    where reference_system.id = ${referenceSystemId}::uuid
  )
  order by nearby_system.position <-> (
    select reference_system.position
    from public.systems as reference_system
    where reference_system.id = ${referenceSystemId}::uuid
  ), nearby_system.id
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
  query: ReturnType<typeof cteSystemsByDistanceQuery>
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

test('systems by distance benchmark compares system-first SQL shapes', async () => {
  const referenceSystemResult = await db.execute(sql<{ id: string }>`
    select system.id
    from public.systems as system
    left join public.stations as station
      on station."systemId" = system.id
    group by system.id
    order by count(station.id) desc, system.id asc
    limit 1
  `)

  const referenceSystemRows = referenceSystemResult.rows as Array<{ id: string }>
  const referenceSystemId = referenceSystemRows[0]?.id

  assert.ok(referenceSystemId, 'expected at least one system in the database')

  const cteQuery = cteSystemsByDistanceQuery(referenceSystemId)
  const joinedReferenceQuery = joinedReferenceSystemsByDistanceQuery(referenceSystemId)
  const scalarReferenceQuery = scalarReferenceSystemsByDistanceQuery(referenceSystemId)

  const [
    cteRowsResult,
    joinedReferenceRowsResult,
    scalarReferenceRowsResult,
    cteExplainPlan,
    joinedReferenceExplainPlan,
    scalarReferenceExplainPlan,
  ] = await Promise.all([
    db.execute(cteQuery),
    db.execute(joinedReferenceQuery),
    db.execute(scalarReferenceQuery),
    extractExplainPlan(cteQuery),
    extractExplainPlan(joinedReferenceQuery),
    extractExplainPlan(scalarReferenceQuery),
  ])

  const cteSystemIds = (cteRowsResult.rows as SystemIdRow[]).map((row) => row.id)
  const joinedReferenceSystemIds = (joinedReferenceRowsResult.rows as SystemIdRow[]).map(
    (row) => row.id
  )
  const scalarReferenceSystemIds = (scalarReferenceRowsResult.rows as SystemIdRow[]).map(
    (row) => row.id
  )

  assert.deepEqual(joinedReferenceSystemIds, cteSystemIds)
  assert.deepEqual(scalarReferenceSystemIds, cteSystemIds)

  const ctePlanUsesGistIndex = Boolean(
    findNode(cteExplainPlan.Plan, (node) => node['Index Name'] === 'systems_position_index')
  )
  const joinedReferencePlanUsesGistIndex = Boolean(
    findNode(
      joinedReferenceExplainPlan.Plan,
      (node) => node['Index Name'] === 'systems_position_index'
    )
  )
  const scalarReferencePlanUsesGistIndex = Boolean(
    findNode(
      scalarReferenceExplainPlan.Plan,
      (node) => node['Index Name'] === 'systems_position_index'
    )
  )

  console.log([
    {
      query: 'cte-reference',
      planningMs: cteExplainPlan['Planning Time'],
      executionMs: cteExplainPlan['Execution Time'],
      sharedHitBlocks: cteExplainPlan['Shared Hit Blocks'] ?? 0,
      sharedReadBlocks: cteExplainPlan['Shared Read Blocks'] ?? 0,
      topNode: cteExplainPlan.Plan['Node Type'] ?? 'unknown',
      usesSystemsPositionGist: ctePlanUsesGistIndex,
    },
    {
      query: 'joined-reference',
      planningMs: joinedReferenceExplainPlan['Planning Time'],
      executionMs: joinedReferenceExplainPlan['Execution Time'],
      sharedHitBlocks: joinedReferenceExplainPlan['Shared Hit Blocks'] ?? 0,
      sharedReadBlocks: joinedReferenceExplainPlan['Shared Read Blocks'] ?? 0,
      topNode: joinedReferenceExplainPlan.Plan['Node Type'] ?? 'unknown',
      usesSystemsPositionGist: joinedReferencePlanUsesGistIndex,
    },
    {
      query: 'scalar-reference',
      planningMs: scalarReferenceExplainPlan['Planning Time'],
      executionMs: scalarReferenceExplainPlan['Execution Time'],
      sharedHitBlocks: scalarReferenceExplainPlan['Shared Hit Blocks'] ?? 0,
      sharedReadBlocks: scalarReferenceExplainPlan['Shared Read Blocks'] ?? 0,
      topNode: scalarReferenceExplainPlan.Plan['Node Type'] ?? 'unknown',
      usesSystemsPositionGist: scalarReferencePlanUsesGistIndex,
    },
  ])

  console.table([
    {
      query: 'cte-reference',
      planningMs: cteExplainPlan['Planning Time'],
      executionMs: cteExplainPlan['Execution Time'],
      sharedHitBlocks: cteExplainPlan['Shared Hit Blocks'] ?? 0,
      sharedReadBlocks: cteExplainPlan['Shared Read Blocks'] ?? 0,
      topNode: cteExplainPlan.Plan['Node Type'] ?? 'unknown',
      usesSystemsPositionGist: ctePlanUsesGistIndex,
    },
    {
      query: 'joined-reference',
      planningMs: joinedReferenceExplainPlan['Planning Time'],
      executionMs: joinedReferenceExplainPlan['Execution Time'],
      sharedHitBlocks: joinedReferenceExplainPlan['Shared Hit Blocks'] ?? 0,
      sharedReadBlocks: joinedReferenceExplainPlan['Shared Read Blocks'] ?? 0,
      topNode: joinedReferenceExplainPlan.Plan['Node Type'] ?? 'unknown',
      usesSystemsPositionGist: joinedReferencePlanUsesGistIndex,
    },
    {
      query: 'scalar-reference',
      planningMs: scalarReferenceExplainPlan['Planning Time'],
      executionMs: scalarReferenceExplainPlan['Execution Time'],
      sharedHitBlocks: scalarReferenceExplainPlan['Shared Hit Blocks'] ?? 0,
      sharedReadBlocks: scalarReferenceExplainPlan['Shared Read Blocks'] ?? 0,
      topNode: scalarReferenceExplainPlan.Plan['Node Type'] ?? 'unknown',
      usesSystemsPositionGist: scalarReferencePlanUsesGistIndex,
    },
  ])

  assert.equal(typeof cteExplainPlan['Execution Time'], 'number')
  assert.equal(typeof joinedReferenceExplainPlan['Execution Time'], 'number')
  assert.equal(typeof scalarReferenceExplainPlan['Execution Time'], 'number')
}, 60_000)
