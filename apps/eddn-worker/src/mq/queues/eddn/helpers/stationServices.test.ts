import assert from 'node:assert/strict'
import { test, vi } from 'vitest'
import {
  buildStationWritePayload,
  deriveServicesV2FromLegacyServices,
  normalizeStationServices,
  prepareStationWritePayload,
} from './stationServices.js'

test('normalizeStationServices keeps supported lowercase services and reports unsupported values', () => {
  const sentry = { captureMessage: vi.fn() }

  const result = normalizeStationServices({
    rawServices: ['Dock', 'BlackMarket', 'CarrierFuel', '  SHOP  '],
    sentry,
    stationContext: { marketId: 42, name: 'Jameson Memorial', systemId: 'sys-1' },
  })

  assert.deepEqual(result.legacyServices, ['dock', 'blackmarket', 'carrierfuel', 'shop'])
  assert.deepEqual(result.servicesV2, ['dock', 'blackmarket', 'shop'])
  assert.equal(sentry.captureMessage.mock.calls.length, 1)
})

test('deriveServicesV2FromLegacyServices returns supported subset from legacy services json data', () => {
  const sentry = { captureMessage: vi.fn() }

  const result = deriveServicesV2FromLegacyServices({
    legacyServices: ['dock', 'carrierfuel', 'repair'],
    sentry,
    stationContext: { marketId: 9, name: 'Legacy Port', systemId: 'sys-2' },
  })

  assert.deepEqual(result, ['dock', 'repair'])
  assert.equal(sentry.captureMessage.mock.calls.length, 1)
})

test('buildStationWritePayload backfills servicesV2 from legacy services when persisted row is not migrated', () => {
  const sentry = { captureMessage: vi.fn() }

  const result = buildStationWritePayload({
    incomingLegacyServices: undefined,
    incomingServicesV2: undefined,
    persistedServices: ['dock', 'carrierfuel', 'repair'],
    persistedServicesV2: [],
    sentry,
    stationContext: { marketId: 7, name: 'Backfill Hub', systemId: 'sys-3' },
  })

  assert.equal(result.services, undefined)
  assert.deepEqual(result.servicesV2, ['dock', 'repair'])
  assert.equal(sentry.captureMessage.mock.calls.length, 1)
})

test('prepareStationWritePayload backfills servicesV2 on writes when incoming services are missing', () => {
  const sentry = { captureMessage: vi.fn() }

  const result = prepareStationWritePayload({
    incomingServices: undefined,
    persistedServices: ['dock', 'carrierfuel', 'repair'],
    persistedServicesV2: [],
    sentry,
    stationContext: { marketId: 11, name: 'Carrier Relay', systemId: 'sys-4' },
  })

  assert.equal(result.services, undefined)
  assert.deepEqual(result.servicesV2, ['dock', 'repair'])
  assert.equal(sentry.captureMessage.mock.calls.length, 1)
})
