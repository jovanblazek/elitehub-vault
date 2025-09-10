CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS cube;

CREATE TYPE "public"."allegianceEnum" AS ENUM('Alliance', 'Empire', 'Federation', 'Independent', 'Pirate', 'PilotsFederation', 'Thargoids', 'Guardians');--> statement-breakpoint
CREATE TYPE "public"."economyEnum" AS ENUM('Agriculture', 'Colony', 'Damaged', 'Engineer', 'Extraction', 'HighTech', 'Industrial', 'Military', 'Prison', 'PrivateEnterprise', 'Refinery', 'Repair', 'Rescue', 'Service', 'Terraforming', 'Tourism');--> statement-breakpoint
CREATE TYPE "public"."factionConflictStatusEnum" AS ENUM('Pending', 'Active');--> statement-breakpoint
CREATE TYPE "public"."factionConflictTypeEnum" AS ENUM('CivilWar', 'Election', 'War');--> statement-breakpoint
CREATE TYPE "public"."factionGovernmentEnum" AS ENUM('Anarchy', 'Communism', 'Confederacy', 'Cooperative', 'Corporate', 'Democracy', 'Dictatorship', 'Feudal', 'Imperial', 'Patronage', 'PrisonColony', 'Theocracy', 'Workshop');--> statement-breakpoint
CREATE TYPE "public"."factionHappinessEnum" AS ENUM('Elated', 'Happy', 'Discontented', 'Unhappy', 'Despondent');--> statement-breakpoint
CREATE TYPE "public"."factionStateEnum" AS ENUM('Blight', 'Boom', 'Bust', 'CivilLiberty', 'CivilUnrest', 'CivilWar', 'ColdWar', 'Colonisation', 'Drought', 'Election', 'Expansion', 'Famine', 'HistoricEvent', 'Incursion', 'Infested', 'InfrastructureFailure', 'Investment', 'Lockdown', 'NaturalDisaster', 'Outbreak', 'PirateAttack', 'PublicHoliday', 'Revolution', 'Retreat', 'TechnologicalLeap', 'TerroristAttack', 'TradeWar', 'War');--> statement-breakpoint
CREATE TYPE "public"."stationTypeEnum" AS ENUM('Coriolis', 'Orbis', 'Ocellus', 'Outpost', 'PlanetaryPort', 'PlanetaryOutpost', 'AsteroidBase', 'MegaShip', 'FleetCarrier');--> statement-breakpoint
CREATE TYPE "public"."systemSecurityEnum" AS ENUM('Anarchy', 'Low', 'Medium', 'High');--> statement-breakpoint
CREATE TABLE "factionConflicts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"systemId" uuid,
	"factionId" uuid,
	"opponentFactionId" uuid,
	"factionConflictTypeEnum" "factionConflictTypeEnum" NOT NULL,
	"factionConflictStatusEnum" "factionConflictStatusEnum" NOT NULL,
	"factionWonDays" integer DEFAULT 0 NOT NULL,
	"opponentWonDays" integer DEFAULT 0 NOT NULL,
	"factionStake" "citext" NOT NULL,
	"factionStakeStationId" uuid,
	"opponentStake" "citext" NOT NULL,
	"opponentStakeStationId" uuid,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "factionStates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"factionId" uuid,
	"systemId" uuid,
	"factionHappinessEnum" "factionHappinessEnum" NOT NULL,
	"influence" real NOT NULL,
	"factionStateEnum" "factionStateEnum"[] DEFAULT '{}' NOT NULL,
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
	"factionGovernmentEnum" "factionGovernmentEnum" NOT NULL,
	"allegianceEnum" "allegianceEnum" NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" "citext" NOT NULL,
	"stationTypeEnum" "stationTypeEnum",
	"systemId" uuid,
	"controllingFactionId" uuid,
	"distanceFromStar" real NOT NULL,
	"factionEconomyEnum" "economyEnum",
	"services" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "systemFactions" (
	"systemId" uuid,
	"factionId" uuid,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "systemFactions_systemId_factionId_pk" PRIMARY KEY("systemId","factionId")
);
--> statement-breakpoint
CREATE TABLE "systems" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" "citext" NOT NULL,
	"position" "cube" NOT NULL,
	"x" integer NOT NULL,
	"y" integer NOT NULL,
	"z" integer NOT NULL,
	"population" integer DEFAULT 0 NOT NULL,
	"factionGovernmentEnum" "factionGovernmentEnum",
	"allegianceEnum" "allegianceEnum",
	"factionEconomyEnum" "economyEnum",
	"systemSecurityEnum" "systemSecurityEnum",
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "systems_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "factionConflicts" ADD CONSTRAINT "factionConflicts_systemId_systems_id_fk" FOREIGN KEY ("systemId") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "factionConflicts" ADD CONSTRAINT "factionConflicts_factionId_factions_id_fk" FOREIGN KEY ("factionId") REFERENCES "public"."factions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "factionConflicts" ADD CONSTRAINT "factionConflicts_opponentFactionId_factions_id_fk" FOREIGN KEY ("opponentFactionId") REFERENCES "public"."factions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "factionConflicts" ADD CONSTRAINT "factionConflicts_factionStakeStationId_stations_id_fk" FOREIGN KEY ("factionStakeStationId") REFERENCES "public"."stations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "factionConflicts" ADD CONSTRAINT "factionConflicts_opponentStakeStationId_stations_id_fk" FOREIGN KEY ("opponentStakeStationId") REFERENCES "public"."stations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "factionStates" ADD CONSTRAINT "factionStates_factionId_factions_id_fk" FOREIGN KEY ("factionId") REFERENCES "public"."factions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "factionStates" ADD CONSTRAINT "factionStates_systemId_systems_id_fk" FOREIGN KEY ("systemId") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stations" ADD CONSTRAINT "stations_systemId_systems_id_fk" FOREIGN KEY ("systemId") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stations" ADD CONSTRAINT "stations_controllingFactionId_factions_id_fk" FOREIGN KEY ("controllingFactionId") REFERENCES "public"."factions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "systemFactions" ADD CONSTRAINT "systemFactions_systemId_systems_id_fk" FOREIGN KEY ("systemId") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "systemFactions" ADD CONSTRAINT "systemFactions_factionId_factions_id_fk" FOREIGN KEY ("factionId") REFERENCES "public"."factions"("id") ON DELETE cascade ON UPDATE no action;