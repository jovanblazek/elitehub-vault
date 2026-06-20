import type { StationService } from '@elitehub/db/schema'
import { StationServiceSchema } from '../validationSchemas.js'

type StationContext = {
  marketId: number | null
  name: string
  systemId: string
}

type SentryCaptureMessage = (
  message: string,
  options?: {
    level?: 'info' | 'warning' | 'error'
    tags?: Record<string, string>
    contexts?: Record<string, Record<string, unknown>>
  }
) => unknown

type SentryLike = {
  captureMessage: SentryCaptureMessage
}

type NormalizeStationServicesInput = {
  rawServices: string[] | undefined
  sentry: SentryLike
  stationContext: StationContext
}

type DeriveServicesV2FromLegacyServicesInput = {
  legacyServices: unknown[] | undefined
  sentry: SentryLike
  stationContext: StationContext
}

type BuildStationWritePayloadInput = {
  incomingLegacyServices: string[] | undefined
  incomingServicesV2: StationService[] | undefined
  persistedServices: unknown[] | undefined
  persistedServicesV2: StationService[] | undefined
  sentry: SentryLike
  stationContext: StationContext
}

const normalizeServiceValues = (services: readonly unknown[]) =>
  services.flatMap((service) =>
    typeof service === 'string' ? [service.trim().toLowerCase()].filter(Boolean) : []
  )

const partitionStationServices = (services: readonly string[]) => {
  const supportedServices: StationService[] = []
  const unsupportedServices: string[] = []

  for (const service of services) {
    const parsedService = StationServiceSchema.safeParse(service)

    if (parsedService.success) {
      supportedServices.push(parsedService.data)
      continue
    }

    unsupportedServices.push(service)
  }

  return {
    supportedServices,
    unsupportedServices,
  }
}

const warnUnsupportedStationServices = ({
  sentry,
  stationContext,
  unsupportedServices,
  source,
}: {
  sentry: SentryLike
  stationContext: StationContext
  unsupportedServices: string[]
  source: 'eddn' | 'legacy-services'
}) => {
  if (unsupportedServices.length === 0) {
    return
  }

  sentry.captureMessage('Unsupported station services received', {
    level: 'warning',
    tags: {
      component: 'station-services',
      source,
    },
    contexts: {
      station: {
        marketId: stationContext.marketId,
        name: stationContext.name,
        systemId: stationContext.systemId,
      },
      stationServices: {
        unsupportedServices,
      },
    },
  })
}

export const normalizeStationServices = ({
  rawServices,
  sentry,
  stationContext,
}: NormalizeStationServicesInput) => {
  if (rawServices === undefined) {
    return {
      legacyServices: undefined,
      servicesV2: undefined,
    }
  }

  const legacyServices = normalizeServiceValues(rawServices)
  const { supportedServices, unsupportedServices } = partitionStationServices(legacyServices)

  warnUnsupportedStationServices({
    sentry,
    stationContext,
    unsupportedServices,
    source: 'eddn',
  })

  return {
    legacyServices,
    servicesV2: supportedServices,
  }
}

export const deriveServicesV2FromLegacyServices = ({
  legacyServices,
  sentry,
  stationContext,
}: DeriveServicesV2FromLegacyServicesInput) => {
  const normalizedLegacyServices = normalizeServiceValues(legacyServices ?? [])
  const { supportedServices, unsupportedServices } = partitionStationServices(normalizedLegacyServices)

  warnUnsupportedStationServices({
    sentry,
    stationContext,
    unsupportedServices,
    source: 'legacy-services',
  })

  return supportedServices
}

export const buildStationWritePayload = ({
  incomingLegacyServices,
  incomingServicesV2,
  persistedServices,
  persistedServicesV2,
  sentry,
  stationContext,
}: BuildStationWritePayloadInput) => {
  if (incomingLegacyServices !== undefined) {
    return {
      services: incomingLegacyServices,
      servicesV2: incomingServicesV2 ?? [],
    }
  }

  const shouldBackfillServicesV2 =
    (persistedServicesV2?.length ?? 0) === 0 && (persistedServices?.length ?? 0) > 0

  if (!shouldBackfillServicesV2) {
    return {
      services: undefined,
      servicesV2: undefined,
    }
  }

  return {
    services: undefined,
    servicesV2: deriveServicesV2FromLegacyServices({
      legacyServices: persistedServices,
      sentry,
      stationContext,
    }),
  }
}
