CREATE TABLE "import_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"keyword" text NOT NULL,
	"source_filename" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"retained_count" integer,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer NOT NULL,
	"source" text NOT NULL,
	"collected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"text" text NOT NULL,
	"sentiment_original" text,
	"timestamp" timestamp with time zone NOT NULL,
	"user" text NOT NULL,
	"platform" text NOT NULL,
	"hashtags" text,
	"retweets" integer,
	"likes" integer,
	"country" text,
	"keyword" text NOT NULL,
	CONSTRAINT "messages_dedup_key" UNIQUE("platform","user","text","timestamp")
);
--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_run_id_import_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."import_runs"("id") ON DELETE no action ON UPDATE no action;