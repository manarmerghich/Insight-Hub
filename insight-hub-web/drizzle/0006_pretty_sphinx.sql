-- Défaut temporaire pour ne pas bloquer la migration si des lignes existent déjà
-- (voir design.md de add-visitor-session-scoping, Decision "Lignes existantes
-- sans visitor_id : sentinelle, pas suppression") — retiré juste après, pour
-- que tout futur INSERT soit obligé de fournir un vrai visitor_id.
ALTER TABLE "import_runs" ADD COLUMN "visitor_id" text NOT NULL DEFAULT 'legacy-shared';--> statement-breakpoint
ALTER TABLE "import_runs" ALTER COLUMN "visitor_id" DROP DEFAULT;--> statement-breakpoint
CREATE INDEX "import_runs_visitor_id_idx" ON "import_runs" USING btree ("visitor_id");