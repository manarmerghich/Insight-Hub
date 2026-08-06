CREATE TABLE "executive_summaries" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer NOT NULL,
	"scope_key" text NOT NULL,
	"summary_text" text NOT NULL,
	"model" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "executive_summaries_scope_key" UNIQUE("run_id","scope_key")
);
--> statement-breakpoint
ALTER TABLE "executive_summaries" ADD CONSTRAINT "executive_summaries_run_id_import_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."import_runs"("id") ON DELETE no action ON UPDATE no action;