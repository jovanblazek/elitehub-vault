WITH "rankedPowerplayConflicts" AS (
  SELECT
    ctid,
    row_number() OVER (
      PARTITION BY "systemId", "powerId"
      ORDER BY "updatedAt" DESC, "createdAt" DESC, "id" DESC
    ) AS "rowNumber"
  FROM "powerplayConflicts"
)
DELETE FROM "powerplayConflicts"
WHERE ctid IN (
  SELECT ctid
  FROM "rankedPowerplayConflicts"
  WHERE "rowNumber" > 1
);
--> statement-breakpoint
ALTER TABLE "powerplayConflicts" ADD CONSTRAINT "powerplayConflicts_systemId_powerId_unique" UNIQUE("systemId","powerId");
