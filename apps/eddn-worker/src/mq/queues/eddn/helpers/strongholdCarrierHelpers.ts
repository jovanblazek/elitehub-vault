import { Economy, PowerplayState, Stations, StationType, Systems } from '@elitehub/db/schema'
import { and, desc, eq } from 'drizzle-orm'
import type { Transaction } from './systemHelpers.js'

const STRONGHOLD_CARRIER_NAME = 'Stronghold Carrier'
const STRONGHOLD_CARRIER_NAMES = new Set([
  STRONGHOLD_CARRIER_NAME,
  'Hochburg-Carrier',
  'Portanaves bastión',
  'Porte-vaisseaux de forteresse',
  'Transportadora da potência',
  'Носитель-база',
])
const STRONGHOLD_CARRIER_SMALL_PADS = 4
const STRONGHOLD_CARRIER_MEDIUM_PADS = 4
const STRONGHOLD_CARRIER_LARGE_PADS = 2

type StrongholdCarrierShape = Pick<
  typeof Stations.$inferInsert,
  'name' | 'stationType' | 'economy' | 'landingPadsSmall' | 'landingPadsMedium' | 'landingPadsLarge'
>

const hasStrongholdCarrierCharacteristics = (station: StrongholdCarrierShape) =>
  station.stationType === StationType.PlanetaryOutpost &&
  station.economy === Economy.HighTech &&
  station.landingPadsSmall === STRONGHOLD_CARRIER_SMALL_PADS &&
  station.landingPadsMedium === STRONGHOLD_CARRIER_MEDIUM_PADS &&
  station.landingPadsLarge === STRONGHOLD_CARRIER_LARGE_PADS

export const isStrongholdCarrier = (station: StrongholdCarrierShape) =>
  station.name === STRONGHOLD_CARRIER_NAME && hasStrongholdCarrierCharacteristics(station)

export const normalizeStrongholdCarrierName = <T extends StrongholdCarrierShape>(station: T): T => {
  if (
    !STRONGHOLD_CARRIER_NAMES.has(station.name) ||
    !hasStrongholdCarrierCharacteristics(station) ||
    station.name === STRONGHOLD_CARRIER_NAME
  ) {
    return station
  }

  return {
    ...station,
    name: STRONGHOLD_CARRIER_NAME,
  }
}

const getStrongholdCarrierPredicate = (systemId: string) =>
  and(
    eq(Stations.systemId, systemId),
    eq(Stations.name, STRONGHOLD_CARRIER_NAME),
    eq(Stations.stationType, StationType.PlanetaryOutpost),
    eq(Stations.economy, Economy.HighTech),
    eq(Stations.landingPadsSmall, STRONGHOLD_CARRIER_SMALL_PADS),
    eq(Stations.landingPadsMedium, STRONGHOLD_CARRIER_MEDIUM_PADS),
    eq(Stations.landingPadsLarge, STRONGHOLD_CARRIER_LARGE_PADS)
  )!

export const findStrongholdCarriersInSystem = async (tx: Transaction, systemId: string) =>
  tx
    .select()
    .from(Stations)
    .where(getStrongholdCarrierPredicate(systemId))
    .orderBy(desc(Stations.updatedAt), desc(Stations.createdAt))

export const deleteStrongholdCarriersInSystem = async (tx: Transaction, systemId: string) =>
  tx.delete(Stations).where(getStrongholdCarrierPredicate(systemId))

export const isSystemCurrentlyStronghold = async (tx: Transaction, systemId: string) => {
  const [system] = await tx
    .select({ powerplayState: Systems.powerplayState })
    .from(Systems)
    .where(eq(Systems.id, systemId))
    .limit(1)

  return system?.powerplayState === PowerplayState.Stronghold
}
