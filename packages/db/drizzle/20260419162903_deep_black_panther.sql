TRUNCATE TABLE "apiKeys";--> statement-breakpoint
ALTER TABLE "apiKeys" DROP COLUMN "key";--> statement-breakpoint
ALTER TABLE "apiKeys" ADD COLUMN "publicId" text NOT NULL;--> statement-breakpoint
ALTER TABLE "apiKeys" ADD COLUMN "secretHash" text NOT NULL;--> statement-breakpoint
ALTER TABLE "apiKeys" ADD COLUMN "rpmLimit" integer DEFAULT 60 NOT NULL;--> statement-breakpoint
ALTER TABLE "apiKeys" ADD CONSTRAINT "apiKeys_publicId_unique" UNIQUE("publicId");
