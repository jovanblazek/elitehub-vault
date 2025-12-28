ALTER TABLE "factionConflicts" ALTER COLUMN "factionWonDays" SET DATA TYPE smallint;--> statement-breakpoint
ALTER TABLE "factionConflicts" ALTER COLUMN "opponentWonDays" SET DATA TYPE smallint;--> statement-breakpoint
ALTER TABLE "stations" ALTER COLUMN "landingPadsSmall" SET DATA TYPE smallint;--> statement-breakpoint
ALTER TABLE "stations" ALTER COLUMN "landingPadsMedium" SET DATA TYPE smallint;--> statement-breakpoint
ALTER TABLE "stations" ALTER COLUMN "landingPadsLarge" SET DATA TYPE smallint;--> statement-breakpoint
ALTER TABLE "systems" ALTER COLUMN "population" SET DATA TYPE bigint;