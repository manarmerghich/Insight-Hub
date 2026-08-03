CREATE TABLE "sentiment_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"processed_count" integer,
	"error_count" integer
);
--> statement-breakpoint
CREATE TABLE "sentiment_validation_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sample_size_per_class" integer NOT NULL,
	"status" text DEFAULT 'sampled' NOT NULL,
	"agreement_rate" numeric(5, 4)
);
--> statement-breakpoint
CREATE TABLE "sentiment_validation_samples" (
	"id" serial PRIMARY KEY NOT NULL,
	"validation_run_id" integer NOT NULL,
	"message_id" integer NOT NULL,
	"sentiment_ai" text NOT NULL,
	"sentiment_manual" text
);
--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "sentiment" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "sentiment_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "sentiment_error" text;--> statement-breakpoint
ALTER TABLE "sentiment_validation_samples" ADD CONSTRAINT "sentiment_validation_samples_validation_run_id_sentiment_validation_runs_id_fk" FOREIGN KEY ("validation_run_id") REFERENCES "public"."sentiment_validation_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sentiment_validation_samples" ADD CONSTRAINT "sentiment_validation_samples_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE no action ON UPDATE no action;