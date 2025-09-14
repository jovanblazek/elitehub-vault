CREATE TYPE "public"."powerplayStateEnum" AS ENUM('Unoccupied', 'Stronghold', 'Exploited', 'Fortified');--> statement-breakpoint
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
CREATE TABLE "systemPowerplayPowers" (
	"systemId" uuid NOT NULL,
	"powerId" uuid NOT NULL,
	CONSTRAINT "systemPowerplayPowers_systemId_powerId_pk" PRIMARY KEY("systemId","powerId")
);
--> statement-breakpoint
ALTER TABLE "stations" ALTER COLUMN "stationTypeEnum" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."stationTypeEnum";--> statement-breakpoint
CREATE TYPE "public"."stationTypeEnum" AS ENUM('Coriolis', 'Orbis', 'Ocellus', 'Outpost', 'PlanetaryPort', 'PlanetaryOutpost', 'AsteroidBase', 'MegaShip');--> statement-breakpoint
ALTER TABLE "stations" ALTER COLUMN "stationTypeEnum" SET DATA TYPE "public"."stationTypeEnum" USING "stationTypeEnum"::"public"."stationTypeEnum";--> statement-breakpoint
ALTER TABLE "factionConflicts" ALTER COLUMN "systemId" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "factionConflicts" ALTER COLUMN "factionId" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "factionConflicts" ALTER COLUMN "factionStake" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "factionConflicts" ALTER COLUMN "opponentStake" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "factionStates" ALTER COLUMN "factionId" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "factionStates" ALTER COLUMN "systemId" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "stations" ALTER COLUMN "systemId" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "stations" ALTER COLUMN "controllingFactionId" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "systemFactions" ALTER COLUMN "systemId" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "systemFactions" ALTER COLUMN "factionId" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "stations" ADD COLUMN "marketId" integer;--> statement-breakpoint
ALTER TABLE "stations" ADD COLUMN "allegianceEnum" "allegianceEnum";--> statement-breakpoint
ALTER TABLE "stations" ADD COLUMN "factionGovernmentEnum" "factionGovernmentEnum";--> statement-breakpoint
ALTER TABLE "stations" ADD COLUMN "economies" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "systems" ADD COLUMN "systemAddress" bigint NOT NULL;--> statement-breakpoint
ALTER TABLE "systems" ADD COLUMN "controllingPowerId" uuid;--> statement-breakpoint
ALTER TABLE "systems" ADD COLUMN "powerplayStateEnum" "powerplayStateEnum";--> statement-breakpoint
ALTER TABLE "systems" ADD COLUMN "powerplayStateControlProgress" double precision;--> statement-breakpoint
ALTER TABLE "systems" ADD COLUMN "powerplayStateReinforcement" double precision;--> statement-breakpoint
ALTER TABLE "systems" ADD COLUMN "powerplayStateUndermining" double precision;--> statement-breakpoint
ALTER TABLE "powerplayConflicts" ADD CONSTRAINT "powerplayConflicts_systemId_systems_id_fk" FOREIGN KEY ("systemId") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "powerplayConflicts" ADD CONSTRAINT "powerplayConflicts_powerId_powerplayPowers_id_fk" FOREIGN KEY ("powerId") REFERENCES "public"."powerplayPowers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "systemPowerplayPowers" ADD CONSTRAINT "systemPowerplayPowers_systemId_systems_id_fk" FOREIGN KEY ("systemId") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "systemPowerplayPowers" ADD CONSTRAINT "systemPowerplayPowers_powerId_powerplayPowers_id_fk" FOREIGN KEY ("powerId") REFERENCES "public"."powerplayPowers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "systems" ADD CONSTRAINT "systems_controllingPowerId_powerplayPowers_id_fk" FOREIGN KEY ("controllingPowerId") REFERENCES "public"."powerplayPowers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stations" ADD CONSTRAINT "stations_marketId_unique" UNIQUE("marketId");--> statement-breakpoint
ALTER TABLE "systems" ADD CONSTRAINT "systems_systemAddress_unique" UNIQUE("systemAddress");