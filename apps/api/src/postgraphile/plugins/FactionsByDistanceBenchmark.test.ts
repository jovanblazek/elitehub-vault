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

type FactionIdRow = {
  id: string
}

const RESULT_LIMIT = 100
const RANKED_SYSTEM_LIMIT = 5_000

const factionFirstByDistanceQuery = (referenceSystemId: string) => sql<FactionIdRow>`
  with reference_system as (
    select system.position
    from public.systems as system
    where system.id = ${referenceSystemId}::uuid
  )
  select faction.id
  from public.factions as faction
  inner join public."systemFactions" as system_faction
    on system_faction."factionId" = faction.id
  inner join public.systems as system
    on system.id = system_faction."systemId"
  inner join reference_system
    on true
  group by faction.id
  order by min(system.position <-> reference_system.position) asc,
  faction.id asc
  limit ${RESULT_LIMIT}
`

const systemFirstNearestFactionByDistanceQuery = (referenceSystemId: string) => sql<FactionIdRow>`
  with ranked_systems as materialized (
    select
      nearby_system.id,
      nearby_system.position <-> (
        select reference_system.position
        from public.systems as reference_system
        where reference_system.id = ${referenceSystemId}::uuid
      ) as __distance
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
    limit ${RANKED_SYSTEM_LIMIT}
  )
  select ranked_factions.id
  from (
    select distinct on (faction.id)
      faction.id,
      ranked_systems.__distance,
      ranked_systems.id as nearby_system_id
    from ranked_systems
    inner join public."systemFactions" as system_faction
      on system_faction."systemId" = ranked_systems.id
    inner join public.factions as faction
      on faction.id = system_faction."factionId"
    order by faction.id, ranked_systems.__distance, ranked_systems.id
  ) as ranked_factions
  order by ranked_factions.__distance, ranked_factions.id
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
  query: ReturnType<typeof factionFirstByDistanceQuery>
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

test('factions by distance benchmark compares faction-first and system-first SQL shapes', async () => {
  const referenceSystemResult = await db.execute(sql<{ id: string }>`
    select system.id
    from public.systems as system
    inner join public."systemFactions" as system_faction
      on system_faction."systemId" = system.id
    group by system.id
    order by count(*) desc, system.id asc
    limit 1
  `)

  const referenceSystemRows = referenceSystemResult.rows as Array<{ id: string }>
  const referenceSystemId = referenceSystemRows[0]?.id

  assert.ok(referenceSystemId, 'expected at least one system with factions in the database')

  const factionFirstQuery = factionFirstByDistanceQuery(referenceSystemId)
  const systemFirstQuery = systemFirstNearestFactionByDistanceQuery(referenceSystemId)

  const [factionFirstRowsResult, systemFirstRowsResult, factionFirstExplainPlan, systemFirstExplainPlan] =
    await Promise.all([
      db.execute(factionFirstQuery),
      db.execute(systemFirstQuery),
      extractExplainPlan(factionFirstQuery),
      extractExplainPlan(systemFirstQuery),
    ])

  const factionFirstFactionIds = (factionFirstRowsResult.rows as FactionIdRow[]).map((row) => row.id)
  const systemFirstFactionIds = (systemFirstRowsResult.rows as FactionIdRow[]).map((row) => row.id)

  assert.deepEqual(systemFirstFactionIds, factionFirstFactionIds)

  const factionFirstPlanUsesGistIndex = Boolean(
    findNode(factionFirstExplainPlan.Plan, (node) => node['Index Name'] === 'systems_position_index')
  )
  const systemFirstPlanUsesGistIndex = Boolean(
    findNode(systemFirstExplainPlan.Plan, (node) => node['Index Name'] === 'systems_position_index')
  )

  console.table([
    {
      query: 'faction-first',
      planningMs: factionFirstExplainPlan['Planning Time'],
      executionMs: factionFirstExplainPlan['Execution Time'],
      sharedHitBlocks: factionFirstExplainPlan['Shared Hit Blocks'] ?? 0,
      sharedReadBlocks: factionFirstExplainPlan['Shared Read Blocks'] ?? 0,
      topNode: factionFirstExplainPlan.Plan['Node Type'] ?? 'unknown',
      usesSystemsPositionGist: factionFirstPlanUsesGistIndex,
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
  assert.equal(factionFirstPlanUsesGistIndex, false)
  assert.equal(systemFirstPlanUsesGistIndex, true)
  assert.equal(typeof factionFirstExplainPlan['Execution Time'], 'number')
  assert.equal(typeof systemFirstExplainPlan['Execution Time'], 'number')
}, 60_000)
