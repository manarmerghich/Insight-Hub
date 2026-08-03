CREATE TABLE "theme_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"processed_count" integer,
	"error_count" integer
);
--> statement-breakpoint
CREATE TABLE "themes" (
	"id" serial PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "theme_id" integer;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "theme_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "theme_error" text;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_theme_id_themes_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."themes"("id") ON DELETE no action ON UPDATE no action;