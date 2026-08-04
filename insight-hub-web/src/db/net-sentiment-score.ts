import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { messages } from "@/db/schema";
import { dashboardFilterConditions, type DashboardFilters } from "@/db/dashboard-filters";
import { mapOriginalSentimentToCategory } from "@/db/original-sentiment-mapping";

// La classification IA (Gemini, voir ai-sentiment-analysis) est active :
// le score net et son évolution utilisent désormais le sentiment recalculé
// (sentiment/sentiment_status = 'completed'), la source officielle du PRD.
// Repasser à "csv_original" seulement si l'API IA redevient indisponible.
export const NET_SENTIMENT_SOURCE: "ai" | "csv_original" = "ai";

export type DailyNetSentiment = {
  date: string;
  positive: number;
  negative: number;
  neutral: number;
  total: number;
  netScore: number;
};

function computeNetScore(positive: number, negative: number, total: number): number {
  return Math.round(((positive - negative) / total) * 100);
}

export async function getNetSentimentScore(
  runId: number | null,
  filters: DashboardFilters,
): Promise<number | null> {
  if (runId === null) return null;

  if (NET_SENTIMENT_SOURCE === "csv_original") {
    const rows = await db
      .select({ sentimentOriginal: messages.sentimentOriginal })
      .from(messages)
      .where(
        and(eq(messages.runId, runId), ...dashboardFilterConditions(filters, "csv_original")),
      );

    let positive = 0;
    let negative = 0;
    let total = 0;
    for (const row of rows) {
      const category = mapOriginalSentimentToCategory(row.sentimentOriginal);
      if (!category) continue;
      if (category === "positive") positive++;
      else if (category === "negative") negative++;
      total++;
    }

    if (total === 0) return null;
    return computeNetScore(positive, negative, total);
  }

  const [row] = await db
    .select({
      positive: sql<number>`count(*) filter (where ${messages.sentiment} = 'positif')`.mapWith(
        Number,
      ),
      negative: sql<number>`count(*) filter (where ${messages.sentiment} = 'négatif')`.mapWith(
        Number,
      ),
      total: sql<number>`count(*) filter (where ${messages.sentimentStatus} = 'completed')`.mapWith(
        Number,
      ),
    })
    .from(messages)
    .where(and(eq(messages.runId, runId), ...dashboardFilterConditions(filters, "ai")));

  if (!row || row.total === 0) return null;
  return computeNetScore(row.positive, row.negative, row.total);
}

export async function getDailyNetSentimentEvolution(
  runId: number | null,
  filters: DashboardFilters,
): Promise<DailyNetSentiment[]> {
  if (runId === null) return [];

  if (NET_SENTIMENT_SOURCE === "csv_original") {
    const rows = await db
      .select({ timestamp: messages.timestamp, sentimentOriginal: messages.sentimentOriginal })
      .from(messages)
      .where(
        and(eq(messages.runId, runId), ...dashboardFilterConditions(filters, "csv_original")),
      );

    const byDay = new Map<
      string,
      { positive: number; negative: number; neutral: number; total: number }
    >();
    for (const row of rows) {
      const category = mapOriginalSentimentToCategory(row.sentimentOriginal);
      if (!category) continue;

      const day = row.timestamp.toISOString().slice(0, 10);
      const bucket = byDay.get(day) ?? { positive: 0, negative: 0, neutral: 0, total: 0 };
      bucket[category]++;
      bucket.total++;
      byDay.set(day, bucket);
    }

    return Array.from(byDay, ([date, bucket]) => ({
      date,
      ...bucket,
      netScore: computeNetScore(bucket.positive, bucket.negative, bucket.total),
    })).sort((a, b) => a.date.localeCompare(b.date));
  }

  const day = sql`date_trunc('day', ${messages.timestamp})`;

  const rows = await db
    .select({
      date: sql<string>`to_char(${day}, 'YYYY-MM-DD')`,
      positive: sql<number>`count(*) filter (where ${messages.sentiment} = 'positif')`.mapWith(
        Number,
      ),
      negative: sql<number>`count(*) filter (where ${messages.sentiment} = 'négatif')`.mapWith(
        Number,
      ),
      neutral: sql<number>`count(*) filter (where ${messages.sentiment} = 'neutre')`.mapWith(
        Number,
      ),
      total: sql<number>`count(*)`.mapWith(Number),
    })
    .from(messages)
    .where(
      and(
        eq(messages.sentimentStatus, "completed"),
        eq(messages.runId, runId),
        ...dashboardFilterConditions(filters, "ai"),
      ),
    )
    .groupBy(day)
    .orderBy(day);

  return rows.map((row) => ({
    ...row,
    netScore: computeNetScore(row.positive, row.negative, row.total),
  }));
}
