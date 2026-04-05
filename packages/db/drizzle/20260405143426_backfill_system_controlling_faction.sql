WITH ranked_factions AS (
  SELECT
    fs."systemId",
    fs."factionId",
    row_number() OVER (
      PARTITION BY fs."systemId"
      ORDER BY fs."influence" DESC, fs."updatedAt" DESC, fs."createdAt" DESC, fs."factionId" ASC
    ) AS rank
  FROM "factionStates" fs
  INNER JOIN "systems" s
    ON s."id" = fs."systemId"
  WHERE s."controllingFactionId" IS NULL
    AND s."population" > 0
)
UPDATE "systems" s
SET
  "controllingFactionId" = rf."factionId",
  "updatedAt" = now()
FROM ranked_factions rf
WHERE s."id" = rf."systemId"
  AND s."controllingFactionId" IS NULL
  AND s."population" > 0
  AND rf.rank = 1;
