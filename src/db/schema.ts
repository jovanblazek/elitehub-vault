import {
	pgTable,
	integer,
	uuid,
	timestamp,
	text,
	pgEnum,
	real,
	jsonb,
	primaryKey,
	customType,
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
	"None",
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

export const FactionEconomy = pgEnum("factionEconomyEnum", [
	"Agriculture",
	"Colony",
	"Extraction",
	"HighTech",
	"Industrial",
	"Military",
	"None",
	"Refinery",
	"Service",
	"Terraforming",
	"Tourism",
	"Repair",
	"Rescue",
	"Damaged",
])

export const Allegiance = pgEnum("allegianceEnum", [
	"Alliance",
	"Empire",
	"Federation",
	"Independent",
	"None",
	"Pirate",
	"PilotsFederation",
	"Thargoid",
	"Guardian",
])

export const FactionState = pgEnum("factionStateEnum", [
	"None",
	"Boom",
	"Bust",
	"CivilUnrest",
	"CivilWar",
	"CivilLiberty",
	"Election",
	"Expansion",
	"Famine",
	"Investment",
	"Lockdown",
	"Outbreak",
	"PirateAttack",
	"Retreat",
	"War",
	"Blight",
	"Drought",
	"InfrastructureFailure",
	"NaturalDisaster",
	"PublicHoliday",
	"TerroristAttack",
])

export const Systems = pgTable("systems", {
	id: uuid().primaryKey().defaultRandom(),
	name: citext().notNull(),
	position: cube3().notNull(),
	x: integer().notNull(),
	y: integer().notNull(),
	z: integer().notNull(),
	population: integer().notNull(),
	goverment: text().notNull(),
	allegiance: Allegiance("allegianceEnum").notNull(),
	economy: FactionEconomy("factionEconomyEnum").notNull(),
	secondEconomy: FactionEconomy("factionEconomyEnum"),
	security: text().notNull(),
	createdAt: timestamp().notNull().defaultNow(),
	updatedAt: timestamp().notNull().defaultNow(),
})

export const Factions = pgTable("factions", {
	id: uuid().primaryKey().defaultRandom(),
	name: citext().notNull(),
	goverment: text().notNull(),
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
	influence: real().notNull(),
	activeStates: FactionState("factionStateEnum").array().default([]).notNull(),
	recoveringStates: FactionState("factionStateEnum").array().default([]).notNull(),
	pendingStates: FactionState("factionStateEnum").array().default([]).notNull(),
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
	services: jsonb().default([]).notNull(),
	createdAt: timestamp().notNull().defaultNow(),
	updatedAt: timestamp().notNull().defaultNow(),
})
