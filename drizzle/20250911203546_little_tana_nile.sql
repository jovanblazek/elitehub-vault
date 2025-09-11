ALTER TABLE "factionStates" ALTER COLUMN "influence" SET DATA TYPE double precision;--> statement-breakpoint
ALTER TABLE "stations" ALTER COLUMN "distanceFromStar" SET DATA TYPE double precision;--> statement-breakpoint
ALTER TABLE "systems" ALTER COLUMN "x" SET DATA TYPE double precision;--> statement-breakpoint
ALTER TABLE "systems" ALTER COLUMN "y" SET DATA TYPE double precision;--> statement-breakpoint
ALTER TABLE "systems" ALTER COLUMN "z" SET DATA TYPE double precision;
ALTER TABLE "systems" ALTER COLUMN "position" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "systems" drop column "position";--> statement-breakpoint
ALTER TABLE "systems" ADD COLUMN "position" "cube" GENERATED ALWAYS AS (cube(ARRAY["systems"."x", "systems"."y", "systems"."z"])) STORED;--> statement-breakpoint