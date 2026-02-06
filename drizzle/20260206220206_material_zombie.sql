CREATE TABLE "eventOutbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"eventType" text NOT NULL,
	"aggregateId" uuid,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "eventOutbox_createdAt_index" ON "eventOutbox" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "eventOutbox_eventType_index" ON "eventOutbox" USING btree ("eventType");--> statement-breakpoint
CREATE INDEX "eventOutbox_aggregateId_index" ON "eventOutbox" USING btree ("aggregateId");

CREATE OR REPLACE FUNCTION public.enqueue_system_powerplay_updated_event()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
	changed_fields text[] := ARRAY[]::text[];
	event_payload jsonb;
BEGIN
	IF NEW."powerplayState" IS DISTINCT FROM OLD."powerplayState" THEN
		changed_fields := array_append(changed_fields, 'powerplayState');
	END IF;

	IF NEW."powerplayStateControlProgress" IS DISTINCT FROM OLD."powerplayStateControlProgress" THEN
		changed_fields := array_append(changed_fields, 'powerplayStateControlProgress');
	END IF;

	IF NEW."powerplayStateReinforcement" IS DISTINCT FROM OLD."powerplayStateReinforcement" THEN
		changed_fields := array_append(changed_fields, 'powerplayStateReinforcement');
	END IF;

	IF NEW."powerplayStateUndermining" IS DISTINCT FROM OLD."powerplayStateUndermining" THEN
		changed_fields := array_append(changed_fields, 'powerplayStateUndermining');
	END IF;

	IF array_length(changed_fields, 1) > 0 THEN
		event_payload := jsonb_build_object(
			'event', 'systemPowerplayUpdated',
			'systemId', NEW.id,
			'changedFields', to_jsonb(changed_fields),
			'source', 'eddn-worker',
			'metadata', '{}'::jsonb
		);

		INSERT INTO "eventOutbox" ("eventType", "aggregateId", payload)
		VALUES ('systemPowerplayUpdated', NEW.id, event_payload);
	END IF;

	RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER systems_powerplay_updated_outbox_trigger
AFTER UPDATE ON "systems"
FOR EACH ROW
WHEN (
	NEW."powerplayState" IS DISTINCT FROM OLD."powerplayState"
	OR NEW."powerplayStateControlProgress" IS DISTINCT FROM OLD."powerplayStateControlProgress"
	OR NEW."powerplayStateReinforcement" IS DISTINCT FROM OLD."powerplayStateReinforcement"
	OR NEW."powerplayStateUndermining" IS DISTINCT FROM OLD."powerplayStateUndermining"
)
EXECUTE FUNCTION public.enqueue_system_powerplay_updated_event();
