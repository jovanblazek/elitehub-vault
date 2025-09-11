import { SQL, sql } from "drizzle-orm"
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
} from "drizzle-orm/pg-core"

const citext = customType<{ data: string }>({
	dataType() {
		return "citext"
	},
})

const cube3 = customType<{ data: [number, number, number] }>({
	dataType() {
		return "cube"
	},
})

export const SystemSecurity = pgEnum("systemSecurityEnum", [
	"Anarchy",
	"Low",
	"Medium",
	"High",
])

export const StationType = pgEnum("stationTypeEnum", [
	"Coriolis",
	"Orbis",
	"Ocellus",
	"Outpost",
	"PlanetaryPort",
	"PlanetaryOutpost",
	"AsteroidBase",
	"MegaShip",
	"FleetCarrier",
])

export const FactionHappiness = pgEnum("factionHappinessEnum", [
	"Elated",
	"Happy",
	"Discontented",
	"Unhappy",
	"Despondent",
])

export const FactionConflictType = pgEnum("factionConflictTypeEnum", [
	"CivilWar",
	"Election",
	"War",
])

export const FactionConflictStatus = pgEnum("factionConflictStatusEnum", [
	"Pending",
	"Active",
])

export const FactionGovernment = pgEnum("factionGovernmentEnum", [
	"Anarchy",
	"Communism",
	"Confederacy",
	"Cooperative",
	"Corporate",
	"Democracy",
	"Dictatorship",
	"Feudal",
	"Imperial",
	"Patronage",
	"PrisonColony",
	"Theocracy",
	"Workshop",
])

export const Economy = pgEnum("economyEnum", [
	"Agriculture",
	"Colony",
	"Damaged",
	"Engineer",
	"Extraction",
	"HighTech",
	"Industrial",
	"Military",
	"Prison",
	"PrivateEnterprise",
	"Refinery",
	"Repair",
	"Rescue",
	"Service",
	"Terraforming",
	"Tourism",
])

export const Allegiance = pgEnum("allegianceEnum", [
	"Alliance",
	"Empire",
	"Federation",
	"Independent",
	"Pirate",
	"PilotsFederation",
	"Thargoids",
	"Guardians",
])

export const FactionState = pgEnum("factionStateEnum", [
	"Blight",
	"Boom",
	"Bust",
	"CivilLiberty",
	"CivilUnrest",
	"CivilWar",
	"ColdWar",
	"Colonisation",
	"Drought",
	"Election",
	"Expansion",
	"Famine",
	"HistoricEvent",
	"Incursion",
	"Infested",
	"InfrastructureFailure",
	"Investment",
	"Lockdown",
	"NaturalDisaster",
	"Outbreak",
	"PirateAttack",
	"PublicHoliday",
	"Revolution",
	"Retreat",
	"TechnologicalLeap",
	"TerroristAttack",
	"TradeWar",
	"War",
])

export const Systems = pgTable("systems", {
	id: uuid().primaryKey().defaultRandom(),
	name: citext().notNull().unique(),
	position: cube3().generatedAlwaysAs(
		(): SQL => sql`cube(ARRAY[${Systems.x}, ${Systems.y}, ${Systems.z}])`
	),
	x: doublePrecision().notNull(),
	y: doublePrecision().notNull(),
	z: doublePrecision().notNull(),
	population: integer().default(0).notNull(),
	goverment: FactionGovernment("factionGovernmentEnum"),
	allegiance: Allegiance("allegianceEnum"),
	economy: Economy("factionEconomyEnum"),
	secondEconomy: Economy("factionEconomyEnum"),
	security: SystemSecurity("systemSecurityEnum"),
	createdAt: timestamp().notNull().defaultNow(),
	updatedAt: timestamp().notNull().defaultNow(),
})

export const Factions = pgTable("factions", {
	id: uuid().primaryKey().defaultRandom(),
	name: citext().notNull(),
	goverment: FactionGovernment("factionGovernmentEnum").notNull(),
	allegiance: Allegiance("allegianceEnum").notNull(),
	createdAt: timestamp().notNull().defaultNow(),
	updatedAt: timestamp().notNull().defaultNow(),
})

export const SystemFactions = pgTable(
	"systemFactions",
	{
		systemId: uuid().references(() => Systems.id, { onDelete: "cascade" }),
		factionId: uuid().references(() => Factions.id, {
			onDelete: "cascade",
		}),
		createdAt: timestamp().notNull().defaultNow(),
		updatedAt: timestamp().notNull().defaultNow(),
	},
	(table) => [primaryKey({ columns: [table.systemId, table.factionId] })]
)

export const FactionStates = pgTable("factionStates", {
	id: uuid().primaryKey().defaultRandom(),
	factionId: uuid().references(() => Factions.id, { onDelete: "cascade" }),
	systemId: uuid().references(() => Systems.id, { onDelete: "cascade" }),
	happiness: FactionHappiness("factionHappinessEnum").notNull(),
	influence: doublePrecision().notNull(),
	activeStates: FactionState("factionStateEnum")
		.array()
		.default([])
		.notNull(),
	recoveringStates: FactionState("factionStateEnum")
		.array()
		.default([])
		.notNull(),
	pendingStates: FactionState("factionStateEnum")
		.array()
		.default([])
		.notNull(),
	activeStatesRaw: jsonb().default([]).notNull(),
	recoveringStatesRaw: jsonb().default([]).notNull(),
	pendingStatesRaw: jsonb().default([]).notNull(),
	createdAt: timestamp().notNull().defaultNow(),
	updatedAt: timestamp().notNull().defaultNow(),
})

export const FactionConflicts = pgTable("factionConflicts", {
	id: uuid().primaryKey().defaultRandom(),
	systemId: uuid().references(() => Systems.id, { onDelete: "cascade" }),
	factionId: uuid().references(() => Factions.id, { onDelete: "cascade" }),
	opponentFactionId: uuid().references(() => Factions.id, {
		onDelete: "cascade",
	}),
	type: FactionConflictType("factionConflictTypeEnum").notNull(),
	status: FactionConflictStatus("factionConflictStatusEnum").notNull(),
	factionWonDays: integer().notNull().default(0),
	opponentWonDays: integer().notNull().default(0),
	factionStake: citext().notNull(),
	factionStakeStationId: uuid().references(() => Stations.id, {
		onDelete: "set null",
	}),
	opponentStake: citext().notNull(),
	opponentStakeStationId: uuid().references(() => Stations.id, {
		onDelete: "set null",
	}),
	createdAt: timestamp().notNull().defaultNow(),
	updatedAt: timestamp().notNull().defaultNow(),
})

export const Stations = pgTable("stations", {
	id: uuid().primaryKey().defaultRandom(),
	name: citext().notNull(),
	stationType: StationType("stationTypeEnum"),
	systemId: uuid().references(() => Systems.id, { onDelete: "cascade" }),
	controllingFactionId: uuid().references(() => Factions.id, {
		onDelete: "set null",
	}),
	distanceFromStar: doublePrecision().notNull(),
	economy: Economy("factionEconomyEnum"),
	services: jsonb().default([]).notNull(),
	createdAt: timestamp().notNull().defaultNow(),
	updatedAt: timestamp().notNull().defaultNow(),
})
