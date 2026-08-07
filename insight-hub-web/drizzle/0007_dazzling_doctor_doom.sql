ALTER TABLE "messages" DROP CONSTRAINT "messages_dedup_key";--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "visitor_id" text;--> statement-breakpoint
-- Backfill réel (pas une sentinelle) : la vraie valeur est connue via le run
-- qui a inséré chaque message — voir design.md de add-visitor-session-scoping,
-- Decision "Stockage : nouvelle colonne sur import_runs, et sur messages".
UPDATE "messages" SET "visitor_id" = "import_runs"."visitor_id"
FROM "import_runs" WHERE "messages"."run_id" = "import_runs"."id";--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "visitor_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_dedup_key" UNIQUE("visitor_id","platform","user","text","timestamp");
