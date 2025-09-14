/**
 * This file contains the types extracted from the messages sent by the EDDN Gateway.
 * Exported types and interfaces should be prefixed with EDDNJournal or similar prefix.
 */

export interface EDDNJournalMessage {
  $schemaRef: string
  header: {
    uploaderID: string
    /**
     * From Fileheader event if available, else LoadGame if available there.
     */
    gameversion?: string
    /**
     * The `build` value from a Fileheader event if available, else LoadGame if available there.
     */
    gamebuild?: string
    softwareName: string
    softwareVersion: string
    /**
     * Timestamp upon receipt at the gateway. If present, this property will be overwritten by the gateway; submitters are not intended to populate this property.
     */
    gatewayTimestamp?: string
    [k: string]: unknown
  }
  /**
   * Contains all properties from the listed events in the client's journal minus Localised strings and the properties marked below as 'disallowed'
   */
  message: EDDNJournalLocationMessage | EDDNJournalFSDJumpMessage | EDDNJournalCarrierJumpMessage
}

export interface EDDNJournalLocationMessage {
  Body: string
  BodyID: number
  BodyType: 'Star' | 'PlanetaryRing' | 'Station' | 'Planet' | 'Null'
  Docked: boolean
  Factions?: FactionElement[]
  Population: number
  PowerplayConflictProgress?: PowerplayConflictProgress[]
  PowerplayState?: PowerplayState
  Powers?: string[]
  StarPos: number[]
  StarSystem: string
  SystemAddress: number
  SystemAllegiance: string
  SystemEconomy: string
  SystemFaction?: ShortFactionInfo
  SystemGovernment: string
  SystemSecondEconomy: string
  SystemSecurity: string
  event: 'Location'
  horizons?: boolean
  odyssey?: boolean
  timestamp: Date
  ControllingPower?: string
  DistFromStarLS?: number
  Multicrew?: boolean
  PowerplayStateControlProgress?: number
  PowerplayStateReinforcement?: number
  PowerplayStateUndermining?: number
  Taxi?: boolean
  Conflicts?: Conflict[]
  MarketID?: number
  StationAllegiance?: string
  StationEconomies?: StationEconomy[]
  StationEconomy?: string
  StationFaction?: ShortFactionInfo
  StationGovernment?: string
  StationName?: string
  StationServices?: string[]
  StationType?: string
  InSRV?: boolean
  OnFoot?: boolean
}

export interface EDDNJournalFSDJumpMessage {
  Body: string
  BodyID: number
  BodyType: 'Star'
  Population: number
  StarPos: number[]
  StarSystem: string
  SystemAddress: number
  SystemAllegiance: string
  SystemEconomy: string
  SystemGovernment: string
  SystemSecondEconomy: string
  SystemSecurity: string
  event: 'FSDJump'
  horizons?: boolean
  odyssey?: boolean
  timestamp: Date
  Factions?: FactionElement[]
  Multicrew?: boolean
  PowerplayConflictProgress?: PowerplayConflictProgress[]
  PowerplayState?: PowerplayState
  Powers?: string[]
  SystemFaction?: ShortFactionInfo
  Taxi?: boolean
  Conflicts?: Conflict[]
  ControllingPower?: string
  PowerplayStateControlProgress?: number
  PowerplayStateReinforcement?: number
  PowerplayStateUndermining?: number
}

export interface EDDNJournalCarrierJumpMessage {
  Body: string
  BodyID: number
  BodyType: string
  Docked: boolean
  Factions?: FactionElement[]
  MarketID: number
  Multicrew?: boolean
  Population: number
  StarPos: number[]
  StarSystem: string
  StationEconomies: StationEconomy[]
  StationEconomy: string
  StationFaction: ShortFactionInfo
  StationGovernment: string
  StationName: string
  StationServices: string[]
  StationType: string
  SystemAddress: number
  SystemAllegiance: string
  SystemEconomy: string
  SystemFaction: ShortFactionInfo
  SystemGovernment: string
  SystemSecondEconomy: string
  SystemSecurity: string
  Taxi?: boolean
  event: string
  horizons: boolean
  odyssey: boolean
  timestamp: Date
  Conflicts?: Conflict[]
}

type StationEconomy = {
  Name: string
  Proportion: number
}

type PowerplayConflictProgress = {
  ConflictProgress: number
  Power: string
}

type ShortFactionInfo = {
  FactionState?: string
  Name: string
}

type FactionElement = {
  Allegiance: string
  FactionState: string
  Government: string
  Happiness: string
  Influence: number
  Name: string
  ActiveStates?: ActiveState[]
  PendingStates?: StateWithTrend[]
  RecoveringStates?: StateWithTrend[]
}

type ActiveState = {
  State: string
}

type StateWithTrend = {
  State: string
  Trend: number
}

type Conflict = {
  Faction1: FactionInConflict
  Faction2: FactionInConflict
  Status: string
  WarType: string
}

type FactionInConflict = {
  Name: string
  Stake: string
  WonDays: number
}

type PowerplayState = 'Unoccupied' | 'Stronghold' | 'Exploited' | 'Fortified'
