ALTER TABLE "factionConflicts" RENAME COLUMN "factionConflictTypeEnum" TO "type";--> statement-breakpoint
ALTER TABLE "factionConflicts" RENAME COLUMN "factionConflictStatusEnum" TO "status";--> statement-breakpoint
ALTER TABLE "factionStates" RENAME COLUMN "factionHappinessEnum" TO "happiness";--> statement-breakpoint
ALTER TABLE "factionStates" RENAME COLUMN "factionStateEnum" TO "activeStates";--> statement-breakpoint
ALTER TABLE "factions" RENAME COLUMN "factionGovernmentEnum" TO "government";--> statement-breakpoint
ALTER TABLE "factions" RENAME COLUMN "allegianceEnum" TO "allegiance";--> statement-breakpoint
ALTER TABLE "stations" RENAME COLUMN "stationTypeEnum" TO "stationType";--> statement-breakpoint
ALTER TABLE "stations" RENAME COLUMN "allegianceEnum" TO "allegiance";--> statement-breakpoint
ALTER TABLE "stations" RENAME COLUMN "factionGovernmentEnum" TO "government";--> statement-breakpoint
ALTER TABLE "stations" RENAME COLUMN "factionEconomyEnum" TO "economy";--> statement-breakpoint
ALTER TABLE "systems" RENAME COLUMN "factionGovernmentEnum" TO "government";--> statement-breakpoint
ALTER TABLE "systems" RENAME COLUMN "allegianceEnum" TO "allegiance";--> statement-breakpoint
ALTER TABLE "systems" RENAME COLUMN "factionEconomyEnum" TO "economy";--> statement-breakpoint
ALTER TABLE "systems" RENAME COLUMN "systemSecurityEnum" TO "secondEconomy";--> statement-breakpoint
ALTER TABLE "systems" RENAME COLUMN "powerplayStateEnum" TO "security";--> statement-breakpoint
ALTER TABLE "factionStates" ADD COLUMN "recoveringStates" "factionStateEnum"[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "factionStates" ADD COLUMN "pendingStates" "factionStateEnum"[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "systems" ADD COLUMN "powerplayState" "powerplayStateEnum";