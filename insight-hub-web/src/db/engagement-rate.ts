import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { messages } from "@/db/schema";
import { dashboardFilterConditions, type DashboardFilters } from "@/db/dashboard-filters";
import { mapOriginalSentimentToCategory, type SentimentCategory } from "@/db/original-sentiment-mapping";
import { NET_SENTIMENT_SOURCE } from "@/db/net-sentiment-score";

export type SentimentLabel = "positif" | "négatif" | "neutre";

export type EngagementRateEntry = {
  sentiment: SentimentLabel;
  avgLikes: number;
  avgRetweets: number;
};

const CATEGORY_TO_LABEL: Record<SentimentCategory, SentimentLabel> = {
  positive: "positif",
  negative: "négatif",
  neutral: "neutre",
};

const SENTIMENT_LABELS = new Set<SentimentLabel>(["positif", "négatif", "neutre"]);

function isSentimentLabel(value: string | null): value is SentimentLabel {
  return value !== null && SENTIMENT_LABELS.has(value as SentimentLabel);
}

export async function getEngagementRateBySentiment(
  runId: number | null,
  filters: DashboardFilters,
): Promise<EngagementRateEntry[]> {
  if (runId === null) return [];

  if (NET_SENTIMENT_SOURCE === "csv_original") {
    const rows = await db
      .select({
        sentimentOriginal: messages.sentimentOriginal,
        likes: messages.likes,
        retweets: messages.retweets,
      })
      .from(messages)
      .where(
        and(eq(messages.runId, runId), ...dashboardFilterConditions(filters, "csv_original")),
      );

    const byCategory = new Map<SentimentCategory, { likes: number; retweets: number; count: number }>();
    for (const row of rows) {
      const category = mapOriginalSentimentToCategory(row.sentimentOriginal);
      if (!category) continue;
      const bucket = byCategory.get(category) ?? { likes: 0, retweets: 0, count: 0 };
      bucket.likes += row.likes ?? 0;
      bucket.retweets += row.retweets ?? 0;
      bucket.count++;
      byCategory.set(category, bucket);
    }

    return Array.from(byCategory, ([category, bucket]) => ({
      sentiment: CATEGORY_TO_LABEL[category],
      avgLikes: bucket.likes / bucket.count,
      avgRetweets: bucket.retweets / bucket.count,
    }));
  }

  const rows = await db
    .select({
      sentiment: messages.sentiment,
      avgLikes: sql<number>`avg(coalesce(${messages.likes}, 0))`.mapWith(Number),
      avgRetweets: sql<number>`avg(coalesce(${messages.retweets}, 0))`.mapWith(Number),
    })
    .from(messages)
    .where(
      and(
        eq(messages.sentimentStatus, "completed"),
        eq(messages.runId, runId),
        ...dashboardFilterConditions(filters, "ai"),
      ),
    )
    .groupBy(messages.sentiment);

  return rows.filter((row) => isSentimentLabel(row.sentiment)).map((row) => ({
    sentiment: row.sentiment as SentimentLabel,
    avgLikes: row.avgLikes,
    avgRetweets: row.avgRetweets,
  }));
}
