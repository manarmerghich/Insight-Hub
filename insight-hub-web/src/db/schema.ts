import type { SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  index,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

// Pas de type `tsvector` natif dans drizzle-orm/pg-core — nécessaire pour la
// colonne générée de recherche plein texte (voir message-search).
const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

export const importRuns = pgTable("import_runs", {
  id: serial("id").primaryKey(),
  keyword: text("keyword").notNull(),
  sourceFilename: text("source_filename").notNull(),
  status: text("status").notNull().default("running"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  // Messages matching the keyword, before dedup — distinct from retainedCount
  // (newly inserted after dedup), so the UI can tell "no match" from "already imported".
  matchedCount: integer("matched_count"),
  retainedCount: integer("retained_count"),
  errorMessage: text("error_message"),
});

export const messages = pgTable(
  "messages",
  {
    id: serial("id").primaryKey(),
    runId: integer("run_id")
      .notNull()
      .references(() => importRuns.id),
    source: text("source").notNull(),
    collectedAt: timestamp("collected_at", { withTimezone: true }).notNull().defaultNow(),
    text: text("text").notNull(),
    sentimentOriginal: text("sentiment_original"),
    sentiment: text("sentiment"),
    sentimentStatus: text("sentiment_status").notNull().default("pending"),
    sentimentError: text("sentiment_error"),
    themeId: integer("theme_id").references(() => themes.id),
    themeStatus: text("theme_status").notNull().default("pending"),
    themeError: text("theme_error"),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    user: text("user").notNull(),
    platform: text("platform").notNull(),
    hashtags: text("hashtags"),
    retweets: integer("retweets"),
    likes: integer("likes"),
    country: text("country"),
    keyword: text("keyword").notNull(),
    isFavorite: boolean("is_favorite").notNull().default(false),
    // Config 'simple' (pas 'english'/'french') : le contenu importé n'a pas de
    // langue garantie, voir design.md de add-search-favorites-dashboard.
    searchVector: tsvector("search_vector")
      .notNull()
      .generatedAlwaysAs((): SQL => sql`to_tsvector('simple', ${messages.text})`),
  },
  (table) => [
    // Dedup key per design.md: platform + author + normalized text + timestamp.
    unique("messages_dedup_key").on(table.platform, table.user, table.text, table.timestamp),
    index("messages_search_vector_idx").using("gin", table.searchVector),
  ],
);

export const sentimentRuns = pgTable("sentiment_runs", {
  id: serial("id").primaryKey(),
  status: text("status").notNull().default("running"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  processedCount: integer("processed_count"),
  errorCount: integer("error_count"),
});

export const themes = pgTable("themes", {
  id: serial("id").primaryKey(),
  label: text("label").notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const themeRuns = pgTable("theme_runs", {
  id: serial("id").primaryKey(),
  status: text("status").notNull().default("running"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  processedCount: integer("processed_count"),
  errorCount: integer("error_count"),
});

export const executiveSummaries = pgTable(
  "executive_summaries",
  {
    id: serial("id").primaryKey(),
    runId: integer("run_id")
      .notNull()
      .references(() => importRuns.id),
    scopeKey: text("scope_key").notNull(),
    summaryText: text("summary_text").notNull(),
    model: text("model").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("executive_summaries_scope_key").on(table.runId, table.scopeKey)],
);

export const sentimentValidationRuns = pgTable("sentiment_validation_runs", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  sampleSizePerClass: integer("sample_size_per_class").notNull(),
  status: text("status").notNull().default("sampled"),
  agreementRate: numeric("agreement_rate", { precision: 5, scale: 4 }),
});

export const sentimentValidationSamples = pgTable("sentiment_validation_samples", {
  id: serial("id").primaryKey(),
  validationRunId: integer("validation_run_id")
    .notNull()
    .references(() => sentimentValidationRuns.id),
  messageId: integer("message_id")
    .notNull()
    .references(() => messages.id),
  // Snapshot at sampling time — the message's own sentiment may be
  // recomputed later, but the sample must stay comparable to what was annotated.
  sentimentAi: text("sentiment_ai").notNull(),
  sentimentManual: text("sentiment_manual"),
});
