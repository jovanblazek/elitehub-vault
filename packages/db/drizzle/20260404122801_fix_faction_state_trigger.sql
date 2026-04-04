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
  lifecycle_state "factionStateEnum";
BEGIN
  FOR lifecycle_state IN
    SELECT pending_state
    FROM unnest(COALESCE(p_new_pending, ARRAY[]::"factionStateEnum"[])) AS pending_states(pending_state)
    EXCEPT
    SELECT pending_state
    FROM unnest(COALESCE(p_old_pending, ARRAY[]::"factionStateEnum"[])) AS pending_states(pending_state)
  LOOP
    INSERT INTO "eventOutbox" ("eventType", "aggregateId", payload)
    VALUES (
      'factionStateChanged',
      p_system_id,
      jsonb_build_object(
        'factionId', p_faction_id,
        'systemId', p_system_id,
        'stateKind', 'state',
        'state', lifecycle_state,
        'lifecycle', 'pending'
      )
    );
  END LOOP;

  FOR lifecycle_state IN
    SELECT active_state
    FROM unnest(COALESCE(p_new_active, ARRAY[]::"factionStateEnum"[])) AS active_states(active_state)
    EXCEPT
    SELECT active_state
    FROM unnest(COALESCE(p_old_active, ARRAY[]::"factionStateEnum"[])) AS active_states(active_state)
  LOOP
    INSERT INTO "eventOutbox" ("eventType", "aggregateId", payload)
    VALUES (
      'factionStateChanged',
      p_system_id,
      jsonb_build_object(
        'factionId', p_faction_id,
        'systemId', p_system_id,
        'stateKind', 'state',
        'state', lifecycle_state,
        'lifecycle', 'active'
      )
    );
  END LOOP;

  FOR lifecycle_state IN
    SELECT ended_state
    FROM (
      SELECT unnest(COALESCE(p_old_pending, ARRAY[]::"factionStateEnum"[])) AS ended_state
      UNION
      SELECT unnest(COALESCE(p_old_active, ARRAY[]::"factionStateEnum"[])) AS ended_state
    ) old_states
    EXCEPT
    SELECT ended_state
    FROM (
      SELECT unnest(COALESCE(p_new_pending, ARRAY[]::"factionStateEnum"[])) AS ended_state
      UNION
      SELECT unnest(COALESCE(p_new_active, ARRAY[]::"factionStateEnum"[])) AS ended_state
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
        'state', lifecycle_state,
        'lifecycle', 'ended'
      )
    );
  END LOOP;
END;
$$;
