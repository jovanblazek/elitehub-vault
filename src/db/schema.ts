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
  Outpost = 'Outpost',
  PlanetaryPort = 'PlanetaryPort',
  PlanetaryOutpost = 'PlanetaryOutpost',
  AsteroidBase = 'AsteroidBase',
  MegaShip = 'MegaShip',
  FleetCarrier = 'FleetCarrier',
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
  PrisonColony = 'PrisonColony',
  Theocracy = 'Theocracy',
  Workshop = 'Workshop',
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

export const Systems = pgTable('systems', {
  id: uuid().primaryKey().defaultRandom(),
  name: citext().notNull().unique(),
  position: cube3().generatedAlwaysAs(
    (): SQL => sql`cube(ARRAY[${Systems.x}, ${Systems.y}, ${Systems.z}])`
  ),
  x: doublePrecision().notNull(),
  y: doublePrecision().notNull(),
  z: doublePrecision().notNull(),
  population: integer().default(0).notNull(),
  goverment: FactionGovernmentEnum('factionGovernmentEnum'),
  allegiance: AllegianceEnum('allegianceEnum'),
  economy: EconomyEnum('factionEconomyEnum'),
  secondEconomy: EconomyEnum('factionEconomyEnum'),
  security: SystemSecurityEnum('systemSecurityEnum'),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow(),
})

export const Factions = pgTable('factions', {
  id: uuid().primaryKey().defaultRandom(),
  name: citext().notNull(),
  goverment: FactionGovernmentEnum('factionGovernmentEnum').notNull(),
  allegiance: AllegianceEnum('allegianceEnum').notNull(),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow(),
})

export const SystemFactions = pgTable(
  'systemFactions',
  {
    systemId: uuid().references(() => Systems.id, { onDelete: 'cascade' }),
    factionId: uuid().references(() => Factions.id, {
      onDelete: 'cascade',
    }),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp().notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.systemId, table.factionId] })]
)

export const FactionStates = pgTable('factionStates', {
  id: uuid().primaryKey().defaultRandom(),
  factionId: uuid().references(() => Factions.id, { onDelete: 'cascade' }),
  systemId: uuid().references(() => Systems.id, { onDelete: 'cascade' }),
  happiness: FactionHappinessEnum('factionHappinessEnum').notNull(),
  influence: doublePrecision().notNull(),
  activeStates: FactionStateEnum('factionStateEnum').array().default([]).notNull(),
  recoveringStates: FactionStateEnum('factionStateEnum').array().default([]).notNull(),
  pendingStates: FactionStateEnum('factionStateEnum').array().default([]).notNull(),
  activeStatesRaw: jsonb().default([]).notNull(),
  recoveringStatesRaw: jsonb().default([]).notNull(),
  pendingStatesRaw: jsonb().default([]).notNull(),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow(),
})

export const FactionConflicts = pgTable('factionConflicts', {
  id: uuid().primaryKey().defaultRandom(),
  systemId: uuid().references(() => Systems.id, { onDelete: 'cascade' }),
  factionId: uuid().references(() => Factions.id, { onDelete: 'cascade' }),
  opponentFactionId: uuid().references(() => Factions.id, {
    onDelete: 'cascade',
  }),
  type: FactionConflictTypeEnum('factionConflictTypeEnum').notNull(),
  status: FactionConflictStatusEnum('factionConflictStatusEnum').notNull(),
  factionWonDays: integer().notNull().default(0),
  opponentWonDays: integer().notNull().default(0),
  factionStake: citext().notNull(),
  factionStakeStationId: uuid().references(() => Stations.id, {
    onDelete: 'set null',
  }),
  opponentStake: citext().notNull(),
  opponentStakeStationId: uuid().references(() => Stations.id, {
    onDelete: 'set null',
  }),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow(),
})

export const Stations = pgTable('stations', {
  id: uuid().primaryKey().defaultRandom(),
  name: citext().notNull(),
  stationType: StationTypeEnum('stationTypeEnum'),
  systemId: uuid().references(() => Systems.id, { onDelete: 'cascade' }),
  controllingFactionId: uuid().references(() => Factions.id, {
    onDelete: 'set null',
  }),
  distanceFromStar: doublePrecision().notNull(),
  economy: EconomyEnum('factionEconomyEnum'),
  services: jsonb().default([]).notNull(),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow(),
})
