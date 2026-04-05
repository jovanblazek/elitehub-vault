-- Split faction state trigger responsibilities:
-- keep lifecycle event emission row-level because it depends on OLD vs NEW
-- for each individual factionStates row, but move control-threat refresh to
-- statement-level because it recomputes derived state for the whole system and
-- was being redundantly executed once per changed row in multi-row upserts.

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
    RETURN OLD;
  END IF;
END;
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.refresh_system_faction_control_threats_from_faction_states()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  affected_system_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    FOR affected_system_id IN
      SELECT DISTINCT "systemId"
      FROM new_rows
      WHERE "systemId" IS NOT NULL
    LOOP
      PERFORM public.refresh_system_faction_control_threat(affected_system_id);
    END LOOP;
  ELSIF TG_OP = 'UPDATE' THEN
    FOR affected_system_id IN
      SELECT DISTINCT "systemId"
      FROM (
        SELECT "systemId" FROM new_rows
        UNION
        SELECT "systemId" FROM old_rows
      ) affected_rows
      WHERE "systemId" IS NOT NULL
    LOOP
      PERFORM public.refresh_system_faction_control_threat(affected_system_id);
    END LOOP;
  ELSE
    FOR affected_system_id IN
      SELECT DISTINCT "systemId"
      FROM old_rows
      WHERE "systemId" IS NOT NULL
    LOOP
      PERFORM public.refresh_system_faction_control_threat(affected_system_id);
    END LOOP;
  END IF;

  RETURN NULL;
END;
$$;
--> statement-breakpoint

DROP TRIGGER IF EXISTS faction_states_changed_trigger ON "factionStates";
--> statement-breakpoint

CREATE TRIGGER faction_states_changed_trigger
AFTER INSERT OR UPDATE OR DELETE ON "factionStates"
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_faction_state_changed_events();
--> statement-breakpoint

CREATE TRIGGER faction_states_refresh_control_threat_insert_trigger
AFTER INSERT ON "factionStates"
REFERENCING NEW TABLE AS new_rows
FOR EACH STATEMENT
EXECUTE FUNCTION public.refresh_system_faction_control_threats_from_faction_states();
--> statement-breakpoint

CREATE TRIGGER faction_states_refresh_control_threat_update_trigger
AFTER UPDATE ON "factionStates"
REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows
FOR EACH STATEMENT
EXECUTE FUNCTION public.refresh_system_faction_control_threats_from_faction_states();
--> statement-breakpoint

CREATE TRIGGER faction_states_refresh_control_threat_delete_trigger
AFTER DELETE ON "factionStates"
REFERENCING OLD TABLE AS old_rows
FOR EACH STATEMENT
EXECUTE FUNCTION public.refresh_system_faction_control_threats_from_faction_states();
