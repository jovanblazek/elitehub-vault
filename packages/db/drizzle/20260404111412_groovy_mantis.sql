CREATE TABLE "systemFactionControlThreats" (
	"systemId" uuid PRIMARY KEY NOT NULL,
	"factionId" uuid,
	"challengerFactionId" uuid,
	"gap" double precision,
	"isThreatened" boolean DEFAULT false NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "systemFactionControlThreats" ADD CONSTRAINT "systemFactionControlThreats_systemId_systems_id_fk" FOREIGN KEY ("systemId") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "systemFactionControlThreats" ADD CONSTRAINT "systemFactionControlThreats_factionId_factions_id_fk" FOREIGN KEY ("factionId") REFERENCES "public"."factions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "systemFactionControlThreats" ADD CONSTRAINT "systemFactionControlThreats_challengerFactionId_factions_id_fk" FOREIGN KEY ("challengerFactionId") REFERENCES "public"."factions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "systemFactionControlThreats_factionId_index" ON "systemFactionControlThreats" USING btree ("factionId");--> statement-breakpoint
CREATE INDEX "systemFactionControlThreats_challengerFactionId_index" ON "systemFactionControlThreats" USING btree ("challengerFactionId");

CREATE OR REPLACE FUNCTION public.enqueue_faction_presence_changed_event()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  payload jsonb;
  aggregate_system_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    aggregate_system_id := NEW."systemId";
    payload := jsonb_build_object(
      'factionId', NEW."factionId",
      'systemId', NEW."systemId",
      'change', 'entered'
    );
  ELSE
    aggregate_system_id := OLD."systemId";
    payload := jsonb_build_object(
      'factionId', OLD."factionId",
      'systemId', OLD."systemId",
      'change', 'left'
    );
  END IF;

  INSERT INTO "eventOutbox" ("eventType", "aggregateId", payload)
  VALUES ('factionPresenceChanged', aggregate_system_id, payload);

  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;

  RETURN OLD;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER system_factions_presence_insert_trigger
AFTER INSERT ON "systemFactions"
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_faction_presence_changed_event();
--> statement-breakpoint
CREATE TRIGGER system_factions_presence_delete_trigger
AFTER DELETE ON "systemFactions"
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_faction_presence_changed_event();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.emit_faction_state_lifecycle_events(
  p_system_id uuid,
  p_faction_id uuid,
  p_old_pending "factionStateEnum"[],
  p_old_active "factionStateEnum"[],
  p_new_pending "factionStateEnum"[],
  p_new_active "factionStateEnum"[]
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  state_value "factionStateEnum";
BEGIN
  FOR state_value IN
    SELECT state_value
    FROM unnest(COALESCE(p_new_pending, ARRAY[]::"factionStateEnum"[])) AS state_value
    EXCEPT
    SELECT state_value
    FROM unnest(COALESCE(p_old_pending, ARRAY[]::"factionStateEnum"[])) AS state_value
  LOOP
    INSERT INTO "eventOutbox" ("eventType", "aggregateId", payload)
    VALUES (
      'factionStateChanged',
      p_system_id,
      jsonb_build_object(
        'factionId', p_faction_id,
        'systemId', p_system_id,
        'stateKind', 'state',
        'state', state_value,
        'lifecycle', 'pending'
      )
    );
  END LOOP;

  FOR state_value IN
    SELECT state_value
    FROM unnest(COALESCE(p_new_active, ARRAY[]::"factionStateEnum"[])) AS state_value
    EXCEPT
    SELECT state_value
    FROM unnest(COALESCE(p_old_active, ARRAY[]::"factionStateEnum"[])) AS state_value
  LOOP
    INSERT INTO "eventOutbox" ("eventType", "aggregateId", payload)
    VALUES (
      'factionStateChanged',
      p_system_id,
      jsonb_build_object(
        'factionId', p_faction_id,
        'systemId', p_system_id,
        'stateKind', 'state',
        'state', state_value,
        'lifecycle', 'active'
      )
    );
  END LOOP;

  FOR state_value IN
    SELECT state_value
    FROM (
      SELECT unnest(COALESCE(p_old_pending, ARRAY[]::"factionStateEnum"[])) AS state_value
      UNION
      SELECT unnest(COALESCE(p_old_active, ARRAY[]::"factionStateEnum"[])) AS state_value
    ) old_states
    EXCEPT
    SELECT state_value
    FROM (
      SELECT unnest(COALESCE(p_new_pending, ARRAY[]::"factionStateEnum"[])) AS state_value
      UNION
      SELECT unnest(COALESCE(p_new_active, ARRAY[]::"factionStateEnum"[])) AS state_value
    ) new_states
  LOOP
    INSERT INTO "eventOutbox" ("eventType", "aggregateId", payload)
    VALUES (
      'factionStateChanged',
      p_system_id,
      jsonb_build_object(
        'factionId', p_faction_id,
        'systemId', p_system_id,
        'stateKind', 'state',
        'state', state_value,
        'lifecycle', 'ended'
      )
    );
  END LOOP;
END;
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.enqueue_faction_state_changed_events()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.emit_faction_state_lifecycle_events(
      NEW."systemId",
      NEW."factionId",
      ARRAY[]::"factionStateEnum"[],
      ARRAY[]::"factionStateEnum"[],
      NEW."pendingStates",
      NEW."activeStates"
    );
    PERFORM public.refresh_system_faction_control_threat(NEW."systemId");
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.emit_faction_state_lifecycle_events(
      NEW."systemId",
      NEW."factionId",
      OLD."pendingStates",
      OLD."activeStates",
      NEW."pendingStates",
      NEW."activeStates"
    );
    PERFORM public.refresh_system_faction_control_threat(NEW."systemId");
    RETURN NEW;
  ELSE
    PERFORM public.emit_faction_state_lifecycle_events(
      OLD."systemId",
      OLD."factionId",
      OLD."pendingStates",
      OLD."activeStates",
      ARRAY[]::"factionStateEnum"[],
      ARRAY[]::"factionStateEnum"[]
    );
    PERFORM public.refresh_system_faction_control_threat(OLD."systemId");
    RETURN OLD;
  END IF;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER faction_states_changed_trigger
AFTER INSERT OR UPDATE OR DELETE ON "factionStates"
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_faction_state_changed_events();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.emit_faction_conflict_lifecycle_event(
  p_system_id uuid,
  p_faction_id uuid,
  p_opponent_faction_id uuid,
  p_conflict_type "factionConflictTypeEnum",
  p_lifecycle text
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO "eventOutbox" ("eventType", "aggregateId", payload)
  VALUES (
    'factionStateChanged',
    p_system_id,
    jsonb_strip_nulls(
      jsonb_build_object(
        'factionId', p_faction_id,
        'systemId', p_system_id,
        'stateKind', 'conflict',
        'state', p_conflict_type,
        'lifecycle', p_lifecycle,
        'opponentFactionId', p_opponent_faction_id
      )
    )
  );
END;
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.enqueue_faction_conflict_changed_events()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  old_lifecycle text;
  new_lifecycle text;
  signature_changed boolean := false;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    old_lifecycle := CASE
      WHEN OLD.status = 'Pending' THEN 'pending'
      WHEN OLD.status = 'Active' THEN 'active'
      ELSE NULL
    END;
  END IF;

  IF TG_OP <> 'DELETE' THEN
    new_lifecycle := CASE
      WHEN NEW.status = 'Pending' THEN 'pending'
      WHEN NEW.status = 'Active' THEN 'active'
      ELSE NULL
    END;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    signature_changed := OLD.type IS DISTINCT FROM NEW.type
      OR OLD."opponentFactionId" IS DISTINCT FROM NEW."opponentFactionId";
  END IF;

  IF old_lifecycle IS NOT NULL
    AND (new_lifecycle IS NULL OR signature_changed OR old_lifecycle IS DISTINCT FROM new_lifecycle) THEN
    PERFORM public.emit_faction_conflict_lifecycle_event(
      OLD."systemId",
      OLD."factionId",
      OLD."opponentFactionId",
      OLD.type,
      'ended'
    );
  END IF;

  IF new_lifecycle IS NOT NULL
    AND (old_lifecycle IS NULL OR signature_changed OR old_lifecycle IS DISTINCT FROM new_lifecycle) THEN
    PERFORM public.emit_faction_conflict_lifecycle_event(
      NEW."systemId",
      NEW."factionId",
      NEW."opponentFactionId",
      NEW.type,
      new_lifecycle
    );
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER faction_conflicts_changed_trigger
AFTER INSERT OR UPDATE OR DELETE ON "factionConflicts"
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_faction_conflict_changed_events();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.refresh_system_faction_control_threat(p_system_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_threshold double precision := 0.10;
  v_controlling_faction_id uuid;
  v_controller_influence double precision;
  v_challenger_faction_id uuid;
  v_challenger_influence double precision;
  v_gap double precision;
  v_is_threatened boolean := false;
  previous_state "systemFactionControlThreats"%ROWTYPE;
BEGIN
  SELECT *
  INTO previous_state
  FROM "systemFactionControlThreats"
  WHERE "systemId" = p_system_id;

  SELECT "controllingFactionId"
  INTO v_controlling_faction_id
  FROM "systems"
  WHERE id = p_system_id;

  IF v_controlling_faction_id IS NOT NULL THEN
    SELECT influence
    INTO v_controller_influence
    FROM "factionStates"
    WHERE "systemId" = p_system_id
      AND "factionId" = v_controlling_faction_id
    LIMIT 1;
  END IF;

  IF v_controlling_faction_id IS NOT NULL AND v_controller_influence IS NOT NULL THEN
    SELECT "factionId", influence
    INTO v_challenger_faction_id, v_challenger_influence
    FROM "factionStates"
    WHERE "systemId" = p_system_id
      AND "factionId" <> v_controlling_faction_id
    ORDER BY influence DESC, "updatedAt" DESC, "createdAt" DESC, "factionId" ASC
    LIMIT 1;
  END IF;

  IF v_controller_influence IS NOT NULL AND v_challenger_influence IS NOT NULL THEN
    v_gap := v_controller_influence - v_challenger_influence;
    v_is_threatened := v_gap <= v_threshold;
  ELSE
    v_gap := NULL;
    v_is_threatened := false;
  END IF;

  IF previous_state."systemId" IS NULL THEN
    INSERT INTO "systemFactionControlThreats" (
      "systemId",
      "factionId",
      "challengerFactionId",
      "gap",
      "isThreatened",
      "updatedAt"
    )
    VALUES (
      p_system_id,
      v_controlling_faction_id,
      v_challenger_faction_id,
      v_gap,
      v_is_threatened,
      now()
    );

    IF v_is_threatened THEN
      INSERT INTO "eventOutbox" ("eventType", "aggregateId", payload)
      VALUES (
        'factionControlThreatChanged',
        p_system_id,
        jsonb_build_object(
          'factionId', v_controlling_faction_id,
          'systemId', p_system_id,
          'status', 'entered',
          'challengerFactionId', v_challenger_faction_id,
          'gap', v_gap,
          'threshold', v_threshold
        )
      );
    END IF;

    RETURN;
  END IF;

  IF previous_state."isThreatened" IS DISTINCT FROM v_is_threatened THEN
    IF v_is_threatened THEN
      INSERT INTO "eventOutbox" ("eventType", "aggregateId", payload)
      VALUES (
        'factionControlThreatChanged',
        p_system_id,
        jsonb_build_object(
          'factionId', v_controlling_faction_id,
          'systemId', p_system_id,
          'status', 'entered',
          'challengerFactionId', v_challenger_faction_id,
          'gap', v_gap,
          'threshold', v_threshold
        )
      );
    ELSE
      INSERT INTO "eventOutbox" ("eventType", "aggregateId", payload)
      VALUES (
        'factionControlThreatChanged',
        p_system_id,
        jsonb_build_object(
          'factionId', COALESCE(previous_state."factionId", v_controlling_faction_id),
          'systemId', p_system_id,
          'status', 'cleared',
          'challengerFactionId', COALESCE(previous_state."challengerFactionId", v_challenger_faction_id),
          'gap', COALESCE(previous_state."gap", v_gap, v_threshold),
          'threshold', v_threshold
        )
      );
    END IF;
  END IF;

  UPDATE "systemFactionControlThreats"
  SET
    "factionId" = v_controlling_faction_id,
    "challengerFactionId" = v_challenger_faction_id,
    "gap" = v_gap,
    "isThreatened" = v_is_threatened,
    "updatedAt" = now()
  WHERE "systemId" = p_system_id;
END;
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.refresh_system_faction_control_threat_from_systems()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.refresh_system_faction_control_threat(NEW.id);
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER systems_controlling_faction_threat_refresh_trigger
AFTER UPDATE OF "controllingFactionId" ON "systems"
FOR EACH ROW
WHEN (NEW."controllingFactionId" IS DISTINCT FROM OLD."controllingFactionId")
EXECUTE FUNCTION public.refresh_system_faction_control_threat_from_systems();
--> statement-breakpoint

WITH ranked_threats AS (
  SELECT
    s.id AS "systemId",
    s."controllingFactionId" AS "factionId",
    challenger."factionId" AS "challengerFactionId",
    controller.influence - challenger.influence AS gap,
    (controller.influence - challenger.influence) <= 0.10 AS "isThreatened"
  FROM "systems" s
  JOIN "factionStates" controller
    ON controller."systemId" = s.id
   AND controller."factionId" = s."controllingFactionId"
  LEFT JOIN LATERAL (
    SELECT fs."factionId", fs.influence
    FROM "factionStates" fs
    WHERE fs."systemId" = s.id
      AND fs."factionId" <> s."controllingFactionId"
    ORDER BY fs.influence DESC, fs."updatedAt" DESC, fs."createdAt" DESC, fs."factionId" ASC
    LIMIT 1
  ) challenger ON TRUE
  WHERE s."controllingFactionId" IS NOT NULL
)
INSERT INTO "systemFactionControlThreats" (
  "systemId",
  "factionId",
  "challengerFactionId",
  "gap",
  "isThreatened",
  "updatedAt"
)
SELECT
  "systemId",
  "factionId",
  "challengerFactionId",
  gap,
  COALESCE("isThreatened", false),
  now()
FROM ranked_threats
ON CONFLICT ("systemId") DO UPDATE
SET
  "factionId" = EXCLUDED."factionId",
  "challengerFactionId" = EXCLUDED."challengerFactionId",
  "gap" = EXCLUDED."gap",
  "isThreatened" = EXCLUDED."isThreatened",
  "updatedAt" = EXCLUDED."updatedAt";
