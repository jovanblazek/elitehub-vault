ALTER TABLE "stations" ADD COLUMN "landingPadsSmall" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "stations" ADD COLUMN "landingPadsMedium" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "stations" ADD COLUMN "landingPadsLarge" integer DEFAULT 0 NOT NULL;