ALTER TABLE "systems" DROP CONSTRAINT "systems_name_unique";--> statement-breakpoint
CREATE INDEX "systems_name_index" ON "systems" USING btree ("name");