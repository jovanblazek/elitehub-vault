CREATE INDEX "stations_name_index" ON "stations" USING btree ("name");--> statement-breakpoint
ALTER TABLE "stations" ADD CONSTRAINT "stations_systemId_name_unique" UNIQUE("systemId","name");