CREATE INDEX "factionConflicts_factionStakeStationId_index" ON "factionConflicts" USING btree ("factionStakeStationId");--> statement-breakpoint
CREATE INDEX "factionConflicts_opponentStakeStationId_index" ON "factionConflicts" USING btree ("opponentStakeStationId");--> statement-breakpoint
CREATE INDEX "stations_controllingFactionId_index" ON "stations" USING btree ("controllingFactionId");