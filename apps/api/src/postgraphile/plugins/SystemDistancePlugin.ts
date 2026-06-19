import type { Step } from 'postgraphile/grafast'
import { PgSelectSingleStep, TYPES, sql } from 'postgraphile/@dataplan/pg'
import { changeNullability, wrapPlans } from 'postgraphile/utils'

const DISTANCE_META_KEY = '__distance'
const REFERENCE_SYSTEM_ID_META_KEY = '__referenceSystemId'
const systemDistanceState = new WeakMap<
  PgSelectSingleStep,
  {
    distance?: Step
    referenceSystemId?: Step
  }
>()

const SystemDistanceNullabilityPlugin = changeNullability({
  System: {
    distance: {
      args: {
        referenceSystemId: true,
      },
    },
  },
})

const SystemDistanceWrapPlansPlugin = wrapPlans({
  Station: {
    system(plan, $source, fieldArgs, info) {
      const $system = plan($source, fieldArgs, info)

      if (!($source instanceof PgSelectSingleStep) || !($system instanceof PgSelectSingleStep)) {
        return $system
      }

      const $referenceSystemId = $source.getMeta(REFERENCE_SYSTEM_ID_META_KEY)

      if ($referenceSystemId == null) {
        return $system
      }

      const $distance = $source.select(sql`${$source.getClassStep().alias}.${sql.identifier(DISTANCE_META_KEY)}`, TYPES.float, true)
      const $carriedReferenceSystemId = $source.select(
        sql`${$source.getClassStep().alias}.${sql.identifier(REFERENCE_SYSTEM_ID_META_KEY)}`,
        TYPES.uuid,
        true
      )

      systemDistanceState.set($system, {
        distance: $distance,
        referenceSystemId: $carriedReferenceSystemId,
      })

      return $system
    },
  },
  System: {
    distance(plan, $source, fieldArgs, info) {
      if (!($source instanceof PgSelectSingleStep)) {
        return plan($source, fieldArgs, info)
      }

      const cached = systemDistanceState.get($source)
      const $distance = cached?.distance

      if ($distance != null) {
        return $distance
      }

      const explicitReferenceSystemId = fieldArgs.getRaw('referenceSystemId')

      if (explicitReferenceSystemId != null) {
        return plan($source, fieldArgs, info)
      }

      const $referenceSystemId = cached?.referenceSystemId

      if ($referenceSystemId == null) {
        return plan($source, fieldArgs, info)
      }

      return $source.select(
        sql`${$source.getClassStep().alias}.${sql.identifier('position')} <-> (
          select reference_system.position
          from public.systems as reference_system
          where reference_system.id = ${$source.placeholder($referenceSystemId, TYPES.uuid)}
        )`,
        TYPES.float,
        true
      )
    },
  },
})

export const SystemDistancePlugin = [
  SystemDistanceNullabilityPlugin,
  SystemDistanceWrapPlansPlugin,
] as const
