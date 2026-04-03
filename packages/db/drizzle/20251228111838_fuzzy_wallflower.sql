CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS cube;

CREATE TYPE "public"."allegianceEnum" AS ENUM('Alliance', 'Empire', 'Federation', 'Independent', 'Pirate', 'PilotsFederation', 'Thargoids', 'Guardians');--> statement-breakpoint
CREATE TYPE "public"."economyEnum" AS ENUM('Agriculture', 'Colony', 'Damaged', 'Engineer', 'Extraction', 'HighTech', 'Industrial', 'Military', 'Prison', 'PrivateEnterprise', 'Refinery', 'Repair', 'Rescue', 'Service', 'Terraforming', 'Tourism');--> statement-breakpoint
CREATE TYPE "public"."factionConflictStatusEnum" AS ENUM('Pending', 'Active');--> statement-breakpoint
CREATE TYPE "public"."factionConflictTypeEnum" AS ENUM('CivilWar', 'Election', 'War');--> statement-breakpoint
CREATE TYPE "public"."factionGovernmentEnum" AS ENUM('Anarchy', 'Communism', 'Confederacy', 'Cooperative', 'Corporate', 'Democracy', 'Dictatorship', 'Feudal', 'Imperial', 'Patronage', 'Prison', 'PrisonColony', 'Theocracy', 'Workshop');--> statement-breakpoint
CREATE TYPE "public"."factionHappinessEnum" AS ENUM('Elated', 'Happy', 'Discontented', 'Unhappy', 'Despondent');--> statement-breakpoint
CREATE TYPE "public"."factionStateEnum" AS ENUM('Blight', 'Boom', 'Bust', 'CivilLiberty', 'CivilUnrest', 'CivilWar', 'ColdWar', 'Colonisation', 'Drought', 'Election', 'Expansion', 'Famine', 'HistoricEvent', 'Incursion', 'Infested', 'InfrastructureFailure', 'Investment', 'Lockdown', 'NaturalDisaster', 'Outbreak', 'PirateAttack', 'PublicHoliday', 'Revolution', 'Retreat', 'TechnologicalLeap', 'TerroristAttack', 'TradeWar', 'War');--> statement-breakpoint
CREATE TYPE "public"."powerplayStateEnum" AS ENUM('Unoccupied', 'Stronghold', 'Exploited', 'Fortified');--> statement-breakpoint
CREATE TYPE "public"."stationTypeEnum" AS ENUM('Coriolis', 'Orbis', 'Ocellus', 'Dodec', 'Outpost', 'PlanetaryPort', 'PlanetaryOutpost', 'AsteroidBase', 'MegaShip');--> statement-breakpoint
CREATE TYPE "public"."systemSecurityEnum" AS ENUM('Anarchy', 'Low', 'Medium', 'High');--> statement-breakpoint
CREATE TABLE "factionConflicts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"systemId" uuid NOT NULL,
	"factionId" uuid NOT NULL,
	"opponentFactionId" uuid,
	"type" "factionConflictTypeEnum" NOT NULL,
	"status" "factionConflictStatusEnum" NOT NULL,
	"factionWonDays" integer DEFAULT 0 NOT NULL,
	"opponentWonDays" integer DEFAULT 0 NOT NULL,
	"factionStake" "citext",
	"factionStakeStationId" uuid,
	"opponentStake" "citext",
	"opponentStakeStationId" uuid,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "factionStates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"factionId" uuid NOT NULL,
	"systemId" uuid NOT NULL,
	"happiness" "factionHappinessEnum" NOT NULL,
	"influence" double precision NOT NULL,
	"activeStates" "factionStateEnum"[] DEFAULT '{}' NOT NULL,
	"recoveringStates" "factionStateEnum"[] DEFAULT '{}' NOT NULL,
	"pendingStates" "factionStateEnum"[] DEFAULT '{}' NOT NULL,
	"activeStatesRaw" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"recoveringStatesRaw" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"pendingStatesRaw" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "factions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" "citext" NOT NULL,
	"government" "factionGovernmentEnum" NOT NULL,
	"allegiance" "allegianceEnum" NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "factions_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "powerplayConflicts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"systemId" uuid NOT NULL,
	"powerId" uuid NOT NULL,
	"conflictProgress" double precision NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "powerplayPowers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" "citext" NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "powerplayPowers_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "stations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" "citext" NOT NULL,
	"marketId" integer,
	"stationType" "stationTypeEnum",
	"systemId" uuid NOT NULL,
	"controllingFactionId" uuid NOT NULL,
	"distanceFromStar" double precision NOT NULL,
	"allegiance" "allegianceEnum",
	"government" "factionGovernmentEnum",
	"economy" "economyEnum",
	"economies" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"services" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"landingPadsSmall" integer DEFAULT 0 NOT NULL,
	"landingPadsMedium" integer DEFAULT 0 NOT NULL,
	"landingPadsLarge" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stations_marketId_unique" UNIQUE("marketId")
);
--> statement-breakpoint
CREATE TABLE "systemFactions" (
	"systemId" uuid NOT NULL,
	"factionId" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "systemFactions_systemId_factionId_pk" PRIMARY KEY("systemId","factionId")
);
--> statement-breakpoint
CREATE TABLE "systemPowerplayPowers" (
	"systemId" uuid NOT NULL,
	"powerId" uuid NOT NULL,
	CONSTRAINT "systemPowerplayPowers_systemId_powerId_pk" PRIMARY KEY("systemId","powerId")
);
--> statement-breakpoint
CREATE TABLE "systems" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" "citext" NOT NULL,
	"systemAddress" bigint NOT NULL,
	"position" "cube" GENERATED ALWAYS AS (cube(ARRAY["systems"."x", "systems"."y", "systems"."z"])) STORED,
	"x" double precision NOT NULL,
	"y" double precision NOT NULL,
	"z" double precision NOT NULL,
	"population" integer DEFAULT 0 NOT NULL,
	"government" "factionGovernmentEnum",
	"allegiance" "allegianceEnum",
	"economy" "economyEnum",
	"secondEconomy" "economyEnum",
	"security" "systemSecurityEnum",
	"controllingPowerId" uuid,
	"powerplayState" "powerplayStateEnum",
	"powerplayStateControlProgress" double precision,
	"powerplayStateReinforcement" double precision,
	"powerplayStateUndermining" double precision,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "systems_name_unique" UNIQUE("name"),
	CONSTRAINT "systems_systemAddress_unique" UNIQUE("systemAddress")
);
--> statement-breakpoint
ALTER TABLE "factionConflicts" ADD CONSTRAINT "factionConflicts_systemId_systems_id_fk" FOREIGN KEY ("systemId") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "factionConflicts" ADD CONSTRAINT "factionConflicts_factionId_factions_id_fk" FOREIGN KEY ("factionId") REFERENCES "public"."factions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "factionConflicts" ADD CONSTRAINT "factionConflicts_opponentFactionId_factions_id_fk" FOREIGN KEY ("opponentFactionId") REFERENCES "public"."factions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "factionConflicts" ADD CONSTRAINT "factionConflicts_factionStakeStationId_stations_id_fk" FOREIGN KEY ("factionStakeStationId") REFERENCES "public"."stations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "factionConflicts" ADD CONSTRAINT "factionConflicts_opponentStakeStationId_stations_id_fk" FOREIGN KEY ("opponentStakeStationId") REFERENCES "public"."stations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "factionStates" ADD CONSTRAINT "factionStates_factionId_factions_id_fk" FOREIGN KEY ("factionId") REFERENCES "public"."factions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "factionStates" ADD CONSTRAINT "factionStates_systemId_systems_id_fk" FOREIGN KEY ("systemId") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "powerplayConflicts" ADD CONSTRAINT "powerplayConflicts_systemId_systems_id_fk" FOREIGN KEY ("systemId") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "powerplayConflicts" ADD CONSTRAINT "powerplayConflicts_powerId_powerplayPowers_id_fk" FOREIGN KEY ("powerId") REFERENCES "public"."powerplayPowers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stations" ADD CONSTRAINT "stations_systemId_systems_id_fk" FOREIGN KEY ("systemId") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stations" ADD CONSTRAINT "stations_controllingFactionId_factions_id_fk" FOREIGN KEY ("controllingFactionId") REFERENCES "public"."factions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "systemFactions" ADD CONSTRAINT "systemFactions_systemId_systems_id_fk" FOREIGN KEY ("systemId") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "systemFactions" ADD CONSTRAINT "systemFactions_factionId_factions_id_fk" FOREIGN KEY ("factionId") REFERENCES "public"."factions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "systemPowerplayPowers" ADD CONSTRAINT "systemPowerplayPowers_systemId_systems_id_fk" FOREIGN KEY ("systemId") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "systemPowerplayPowers" ADD CONSTRAINT "systemPowerplayPowers_powerId_powerplayPowers_id_fk" FOREIGN KEY ("powerId") REFERENCES "public"."powerplayPowers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "systems" ADD CONSTRAINT "systems_controllingPowerId_powerplayPowers_id_fk" FOREIGN KEY ("controllingPowerId") REFERENCES "public"."powerplayPowers"("id") ON DELETE set null ON UPDATE no action;