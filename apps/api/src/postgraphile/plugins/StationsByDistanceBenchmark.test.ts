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

type StationIdRow = {
  id: string
}

const RESULT_LIMIT = 100

const oldStationsByDistanceQuery = (referenceSystemId: string) => sql<StationIdRow>`
  select station.id
  from public.stations as station
  where exists (
    select 1
    from public.systems as reference_system
    where reference_system.id = ${referenceSystemId}::uuid
  )
  order by (
    select station_system.position <-> reference_system.position
    from public.systems as station_system
    inner join public.systems as reference_system
      on reference_system.id = ${referenceSystemId}::uuid
    where station_system.id = station."systemId"
  ) asc,
  station.id asc
  limit ${RESULT_LIMIT}
`

const newStationsByDistanceQuery = (referenceSystemId: string) => sql<StationIdRow>`
  select station.id
  from public.stations as station
  where exists (
    select 1
    from (
      select
        nearby_system.id,
        nearby_system.position <-> reference_system.position as distance_to_reference
      from public.systems as nearby_system
      inner join public.systems as reference_system
        on reference_system.id = ${referenceSystemId}::uuid
      order by nearby_system.position <-> reference_system.position, nearby_system.id
    ) as ranked_systems
    where ranked_systems.id = station."systemId"
  )
  order by (
    select ranked_systems.distance_to_reference
    from (
      select
        nearby_system.id,
        nearby_system.position <-> reference_system.position as distance_to_reference
      from public.systems as nearby_system
      inner join public.systems as reference_system
        on reference_system.id = ${referenceSystemId}::uuid
      order by nearby_system.position <-> reference_system.position, nearby_system.id
    ) as ranked_systems
    where ranked_systems.id = station."systemId"
  ) asc,
  station.id asc
  limit ${RESULT_LIMIT}
`

const systemFirstStationsByDistanceQuery = (referenceSystemId: string) => sql<StationIdRow>`
  with reference_system as (
    select system.position
    from public.systems as system
    where system.id = ${referenceSystemId}::uuid
  )
  select station.id
  from reference_system
  inner join public.systems as nearby_system
    on true
  inner join public.stations as station
    on station."systemId" = nearby_system.id
  order by nearby_system.position <-> reference_system.position, station.id
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

const extractExplainPlan = async (query: ReturnType<typeof oldStationsByDistanceQuery>) => {
  const result = await db.execute(sql`
    explain (analyze, buffers, format json)
    ${query}
  `)

  const rows = result.rows as Array<{ 'QUERY PLAN': ExplainPlan[] }>
  const explainPlan = rows[0]?.['QUERY PLAN']?.[0]

  assert.ok(explainPlan, 'expected EXPLAIN output')

  return explainPlan
}

test('stations by distance benchmark compares station-first and system-first SQL shapes', async () => {
  const referenceSystemResult = await db.execute(sql<{ id: string }>`
      select system.id
      from public.systems as system
      inner join public.stations as station
        on station."systemId" = system.id
      group by system.id
      order by count(*) desc, system.id asc
      limit 1
    `)

  const referenceSystemRows = referenceSystemResult.rows as Array<{ id: string }>
  const referenceSystemId = referenceSystemRows[0]?.id

  assert.ok(referenceSystemId, 'expected at least one system with stations in the database')

  const oldQuery = oldStationsByDistanceQuery(referenceSystemId)
  const newQuery = newStationsByDistanceQuery(referenceSystemId)
  const systemFirstQuery = systemFirstStationsByDistanceQuery(referenceSystemId)

  const [
    oldRowsResult,
    newRowsResult,
    systemFirstRowsResult,
    oldExplainPlan,
    newExplainPlan,
    systemFirstExplainPlan,
  ] = await Promise.all([
    db.execute(oldQuery),
    db.execute(newQuery),
    db.execute(systemFirstQuery),
    extractExplainPlan(oldQuery),
    extractExplainPlan(newQuery),
    extractExplainPlan(systemFirstQuery),
  ])

  const oldStationIds = (oldRowsResult.rows as StationIdRow[]).map((row) => row.id)
  const newStationIds = (newRowsResult.rows as StationIdRow[]).map((row) => row.id)
  const systemFirstStationIds = (systemFirstRowsResult.rows as StationIdRow[]).map((row) => row.id)

  assert.deepEqual(newStationIds, oldStationIds)
  assert.deepEqual(systemFirstStationIds, oldStationIds)

  const newPlanUsesGistIndex = Boolean(
    findNode(newExplainPlan.Plan, (node) => node['Index Name'] === 'systems_position_index')
  )
  const oldPlanUsesGistIndex = Boolean(
    findNode(oldExplainPlan.Plan, (node) => node['Index Name'] === 'systems_position_index')
  )
  const systemFirstPlanUsesGistIndex = Boolean(
    findNode(systemFirstExplainPlan.Plan, (node) => node['Index Name'] === 'systems_position_index')
  )

  console.log([
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
      query: 'new',
      planningMs: newExplainPlan['Planning Time'],
      executionMs: newExplainPlan['Execution Time'],
      sharedHitBlocks: newExplainPlan['Shared Hit Blocks'] ?? 0,
      sharedReadBlocks: newExplainPlan['Shared Read Blocks'] ?? 0,
      topNode: newExplainPlan.Plan['Node Type'] ?? 'unknown',
      usesSystemsPositionGist: newPlanUsesGistIndex,
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
  ])

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
      query: 'new',
      planningMs: newExplainPlan['Planning Time'],
      executionMs: newExplainPlan['Execution Time'],
      sharedHitBlocks: newExplainPlan['Shared Hit Blocks'] ?? 0,
      sharedReadBlocks: newExplainPlan['Shared Read Blocks'] ?? 0,
      topNode: newExplainPlan.Plan['Node Type'] ?? 'unknown',
      usesSystemsPositionGist: newPlanUsesGistIndex,
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
  ])
  assert.equal(typeof oldExplainPlan['Execution Time'], 'number')
  assert.equal(typeof newExplainPlan['Execution Time'], 'number')
  assert.equal(typeof systemFirstExplainPlan['Execution Time'], 'number')
}, 60_000)
