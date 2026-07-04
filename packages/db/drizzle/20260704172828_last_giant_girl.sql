CREATE TABLE "factionStateHistory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"factionId" uuid NOT NULL,
	"systemId" uuid NOT NULL,
	"isPresent" boolean DEFAULT true NOT NULL,
	"happiness" "factionHappinessEnum",
	"influence" double precision NOT NULL,
	"activeStates" "factionStateEnum"[] DEFAULT '{}' NOT NULL,
	"recoveringStates" "factionStateEnum"[] DEFAULT '{}' NOT NULL,
	"pendingStates" "factionStateEnum"[] DEFAULT '{}' NOT NULL,
	"activeStatesRaw" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"recoveringStatesRaw" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"pendingStatesRaw" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "factionStateHistory" ADD CONSTRAINT "factionStateHistory_factionId_factions_id_fk" FOREIGN KEY ("factionId") REFERENCES "public"."factions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "factionStateHistory" ADD CONSTRAINT "factionStateHistory_systemId_systems_id_fk" FOREIGN KEY ("systemId") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "factionStateHistory_systemId_createdAt_index" ON "factionStateHistory" USING btree ("systemId","createdAt");--> statement-breakpoint
CREATE INDEX "factionStateHistory_factionId_createdAt_index" ON "factionStateHistory" USING btree ("factionId","createdAt");--> statement-breakpoint
CREATE INDEX "factionStateHistory_isPresent_createdAt_index" ON "factionStateHistory" USING btree ("isPresent","createdAt");