ALTER TABLE "systems" ADD COLUMN "controllingFactionId" uuid;--> statement-breakpoint
ALTER TABLE "systems" ADD CONSTRAINT "systems_controllingFactionId_factions_id_fk" FOREIGN KEY ("controllingFactionId") REFERENCES "public"."factions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "systems_controllingFactionId_index" ON "systems" USING btree ("controllingFactionId");--> statement-breakpoint
CREATE INDEX "systems_controllingPowerId_index" ON "systems" USING btree ("controllingPowerId");

-- Migrate existing data to set the controlling faction for each system based on the faction with the highest influence in the system
WITH ranked_factions AS (
  SELECT
    fs."systemId",
    fs."factionId",
    row_number() OVER (
      PARTITION BY fs."systemId"
      ORDER BY fs."influence" DESC, fs."updatedAt" DESC, fs."createdAt" DESC, fs."factionId" ASC
    ) AS rank
  FROM "factionStates" fs
)
UPDATE "systems" s
SET
  "controllingFactionId" = rf."factionId",
  "updatedAt" = now()
FROM ranked_factions rf
WHERE s."id" = rf."systemId"
  AND rf.rank = 1;
