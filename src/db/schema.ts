import { SQL, sql } from 'drizzle-orm'
import {
  pgTable,
  integer,
  uuid,
  timestamp,
  pgEnum,
  jsonb,
  primaryKey,
  customType,
  doublePrecision,
  bigint,
} from 'drizzle-orm/pg-core'

function enumToPgEnum<T extends Record<string, any>>(myEnum: T): [T[keyof T], ...T[keyof T][]] {
  return Object.values(myEnum).map((value: any) => `${value}`) as any
}

const citext = customType<{ data: string }>({
  dataType() {
    return 'citext'
  },
})

const cube3 = customType<{ data: [number, number, number] }>({
  dataType() {
    return 'cube'
  },
})

export enum SystemSecurity {
  Anarchy = 'Anarchy',
  Low = 'Low',
  Medium = 'Medium',
  High = 'High',
}

export const SystemSecurityEnum = pgEnum('systemSecurityEnum', enumToPgEnum(SystemSecurity))

export enum StationType {
  Coriolis = 'Coriolis',
  Orbis = 'Orbis',
  Ocellus = 'Ocellus',
  Dodec = 'Dodec',
  Outpost = 'Outpost',
  PlanetaryPort = 'PlanetaryPort',
  PlanetaryOutpost = 'PlanetaryOutpost',
  AsteroidBase = 'AsteroidBase',
  MegaShip = 'MegaShip',
  // FleetCarrier = 'FleetCarrier', // We do not store fleet carriers
  // SpaceConstructionDepot = 'SpaceConstructionDepot', // We do not store space construction depots
  // PlanetaryConstructionDepot = 'PlanetaryConstructionDepot', // We do not store planetary construction depots
}

export const StationTypeEnum = pgEnum('stationTypeEnum', enumToPgEnum(StationType))

export enum FactionHappiness {
  Elated = 'Elated',
  Happy = 'Happy',
  Discontented = 'Discontented',
  Unhappy = 'Unhappy',
  Despondent = 'Despondent',
}

export const FactionHappinessEnum = pgEnum('factionHappinessEnum', enumToPgEnum(FactionHappiness))

export enum FactionConflictType {
  CivilWar = 'CivilWar',
  Election = 'Election',
  War = 'War',
}

export const FactionConflictTypeEnum = pgEnum(
  'factionConflictTypeEnum',
  enumToPgEnum(FactionConflictType)
)

export enum FactionConflictStatus {
  Pending = 'Pending',
  Active = 'Active',
}

export const FactionConflictStatusEnum = pgEnum(
  'factionConflictStatusEnum',
  enumToPgEnum(FactionConflictStatus)
)

export enum FactionGovernment {
  Anarchy = 'Anarchy',
  Communism = 'Communism',
  Confederacy = 'Confederacy',
  Cooperative = 'Cooperative',
  Corporate = 'Corporate',
  Democracy = 'Democracy',
  Dictatorship = 'Dictatorship',
  Feudal = 'Feudal',
  Imperial = 'Imperial',
  Patronage = 'Patronage',
  Prison = 'Prison',
  PrisonColony = 'PrisonColony',
  Theocracy = 'Theocracy',
  Workshop = 'Workshop',
  // Megaconstruction = 'Megaconstruction',  // We do not store construction sites/colonization ships
  // Carrier = 'Carrier',  // We do not store fleet carriers
}

export const FactionGovernmentEnum = pgEnum(
  'factionGovernmentEnum',
  enumToPgEnum(FactionGovernment)
)

export enum Economy {
  Agriculture = 'Agriculture',
  Colony = 'Colony',
  Damaged = 'Damaged',
  Engineer = 'Engineer',
  Extraction = 'Extraction',
  HighTech = 'HighTech',
  Industrial = 'Industrial',
  Military = 'Military',
  Prison = 'Prison',
  PrivateEnterprise = 'PrivateEnterprise',
  Refinery = 'Refinery',
  Repair = 'Repair',
  Rescue = 'Rescue',
  Service = 'Service',
  Terraforming = 'Terraforming',
  Tourism = 'Tourism',
}

export const EconomyEnum = pgEnum('economyEnum', enumToPgEnum(Economy))

export enum Allegiance {
  Alliance = 'Alliance',
  Empire = 'Empire',
  Federation = 'Federation',
  Independent = 'Independent',
  Pirate = 'Pirate',
  PilotsFederation = 'PilotsFederation',
  Thargoids = 'Thargoids',
  Guardians = 'Guardians',
}

export const AllegianceEnum = pgEnum('allegianceEnum', enumToPgEnum(Allegiance))

export enum FactionState {
  Blight = 'Blight',
  Boom = 'Boom',
  Bust = 'Bust',
  CivilLiberty = 'CivilLiberty',
  CivilUnrest = 'CivilUnrest',
  CivilWar = 'CivilWar',
  ColdWar = 'ColdWar',
  Colonisation = 'Colonisation',
  Drought = 'Drought',
  Election = 'Election',
  Expansion = 'Expansion',
  Famine = 'Famine',
  HistoricEvent = 'HistoricEvent',
  Incursion = 'Incursion',
  Infested = 'Infested',
  InfrastructureFailure = 'InfrastructureFailure',
  Investment = 'Investment',
  Lockdown = 'Lockdown',
  NaturalDisaster = 'NaturalDisaster',
  Outbreak = 'Outbreak',
  PirateAttack = 'PirateAttack',
  PublicHoliday = 'PublicHoliday',
  Revolution = 'Revolution',
  Retreat = 'Retreat',
  TechnologicalLeap = 'TechnologicalLeap',
  TerroristAttack = 'TerroristAttack',
  TradeWar = 'TradeWar',
  War = 'War',
}

export const FactionStateEnum = pgEnum('factionStateEnum', enumToPgEnum(FactionState))

export enum PowerplayState {
  Unoccupied = 'Unoccupied',
  Stronghold = 'Stronghold',
  Exploited = 'Exploited',
  Fortified = 'Fortified',
}

export const PowerplayStateEnum = pgEnum('powerplayStateEnum', enumToPgEnum(PowerplayState))

export const Systems = pgTable('systems', {
  id: uuid().primaryKey().defaultRandom(),
  name: citext().notNull().unique(),
  systemAddress: bigint({ mode: 'number' }).notNull().unique(),
  position: cube3().generatedAlwaysAs(
    (): SQL => sql`cube(ARRAY[${Systems.x}, ${Systems.y}, ${Systems.z}])`
  ),
  x: doublePrecision().notNull(),
  y: doublePrecision().notNull(),
  z: doublePrecision().notNull(),
  population: integer().default(0).notNull(),
  government: FactionGovernmentEnum(),
  allegiance: AllegianceEnum(),
  economy: EconomyEnum(),
  secondEconomy: EconomyEnum(),
  security: SystemSecurityEnum(),
  controllingPowerId: uuid().references(() => PowerplayPowers.id, { onDelete: 'set null' }),
  powerplayState: PowerplayStateEnum(),
  powerplayStateControlProgress: doublePrecision(),
  powerplayStateReinforcement: doublePrecision(),
  powerplayStateUndermining: doublePrecision(),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow(),
})

export const Factions = pgTable('factions', {
  id: uuid().primaryKey().defaultRandom(),
  name: citext().notNull().unique(),
  government: FactionGovernmentEnum().notNull(),
  allegiance: AllegianceEnum().notNull(),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow(),
})

export const SystemFactions = pgTable(
  'systemFactions',
  {
    systemId: uuid()
      .notNull()
      .references(() => Systems.id, { onDelete: 'cascade' }),
    factionId: uuid()
      .notNull()
      .references(() => Factions.id, {
        onDelete: 'cascade',
      }),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp().notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.systemId, table.factionId] })]
)

export const FactionStates = pgTable('factionStates', {
  id: uuid().primaryKey().defaultRandom(),
  factionId: uuid()
    .notNull()
    .references(() => Factions.id, { onDelete: 'cascade' }),
  systemId: uuid()
    .notNull()
    .references(() => Systems.id, { onDelete: 'cascade' }),
  happiness: FactionHappinessEnum().notNull(),
  influence: doublePrecision().notNull(),
  activeStates: FactionStateEnum().array().default([]).notNull(),
  recoveringStates: FactionStateEnum().array().default([]).notNull(),
  pendingStates: FactionStateEnum().array().default([]).notNull(),
  activeStatesRaw: jsonb().default([]).notNull(),
  recoveringStatesRaw: jsonb().default([]).notNull(),
  pendingStatesRaw: jsonb().default([]).notNull(),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow(),
})

export const FactionConflicts = pgTable('factionConflicts', {
  id: uuid().primaryKey().defaultRandom(),
  systemId: uuid()
    .notNull()
    .references(() => Systems.id, { onDelete: 'cascade' }),
  factionId: uuid()
    .notNull()
    .references(() => Factions.id, { onDelete: 'cascade' }),
  opponentFactionId: uuid().references(() => Factions.id, {
    onDelete: 'cascade',
  }),
  type: FactionConflictTypeEnum().notNull(),
  status: FactionConflictStatusEnum().notNull(),
  factionWonDays: integer().notNull().default(0),
  opponentWonDays: integer().notNull().default(0),
  factionStake: citext(),
  factionStakeStationId: uuid().references(() => Stations.id, {
    onDelete: 'set null',
  }),
  opponentStake: citext(),
  opponentStakeStationId: uuid().references(() => Stations.id, {
    onDelete: 'set null',
  }),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow(),
})

export const Stations = pgTable('stations', {
  id: uuid().primaryKey().defaultRandom(),
  name: citext().notNull(),
  marketId: integer().unique(),
  stationType: StationTypeEnum(),
  systemId: uuid()
    .notNull()
    .references(() => Systems.id, { onDelete: 'cascade' }),
  controllingFactionId: uuid()
    .notNull()
    .references(() => Factions.id, {
      onDelete: 'set null',
    }),
  distanceFromStar: doublePrecision().notNull(),
  allegiance: AllegianceEnum(),
  government: FactionGovernmentEnum(),
  economy: EconomyEnum(),
  economies: jsonb().default([]).notNull(),
  services: jsonb().default([]).notNull(),
  landingPadsSmall: integer().notNull().default(0),
  landingPadsMedium: integer().notNull().default(0),
  landingPadsLarge: integer().notNull().default(0),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow(),
})

export const PowerplayPowers = pgTable('powerplayPowers', {
  id: uuid().primaryKey().defaultRandom(),
  name: citext().notNull().unique(),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow(),
})

export const SystemPowerplayPowers = pgTable(
  'systemPowerplayPowers',
  {
    systemId: uuid()
      .notNull()
      .references(() => Systems.id, { onDelete: 'cascade' }),
    powerId: uuid()
      .notNull()
      .references(() => PowerplayPowers.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.systemId, table.powerId] })]
)

export const PowerplayConflicts = pgTable('powerplayConflicts', {
  id: uuid().primaryKey().defaultRandom(),
  systemId: uuid()
    .notNull()
    .references(() => Systems.id, { onDelete: 'cascade' }),
  powerId: uuid()
    .notNull()
    .references(() => PowerplayPowers.id, { onDelete: 'cascade' }),
  conflictProgress: doublePrecision().notNull(),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow(),
})
