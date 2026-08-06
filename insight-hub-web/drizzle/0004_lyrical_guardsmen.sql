ALTER TABLE "messages" ADD COLUMN "is_favorite" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "search_vector" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', "messages"."text")) STORED NOT NULL;--> statement-breakpoint
CREATE INDEX "messages_search_vector_idx" ON "messages" USING gin ("search_vector");