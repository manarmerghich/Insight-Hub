import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { messages } from "@/db/schema";
import { dashboardFilterConditions, type DashboardFilters } from "@/db/dashboard-filters";
import { mapOriginalSentimentToCategory } from "@/db/original-sentiment-mapping";
import { NET_SENTIMENT_SOURCE } from "@/db/net-sentiment-score";

function computeWeightedScore(
  positiveWeight: number,
  negativeWeight: number,
  totalWeight: number,
): number {
  return Math.round(((positiveWeight - negativeWeight) / totalWeight) * 100);
}

export async function getWeightedSentimentScore(
  runId: number | null,
  filters: DashboardFilters,
): Promise<number | null> {
  if (runId === null) return null;

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

    let positiveWeight = 0;
    let negativeWeight = 0;
    let totalWeight = 0;
    for (const row of rows) {
      const category = mapOriginalSentimentToCategory(row.sentimentOriginal);
      if (!category) continue;
      const weight = 1 + (row.likes ?? 0) + (row.retweets ?? 0);
      if (category === "positive") positiveWeight += weight;
      else if (category === "negative") negativeWeight += weight;
      totalWeight += weight;
    }

    if (totalWeight === 0) return null;
    return computeWeightedScore(positiveWeight, negativeWeight, totalWeight);
  }

  const weight = sql`(1 + coalesce(${messages.likes}, 0) + coalesce(${messages.retweets}, 0))`;

  const [row] = await db
    .select({
      positiveWeight:
        sql<number>`coalesce(sum(${weight}) filter (where ${messages.sentiment} = 'positif'), 0)`.mapWith(
          Number,
        ),
      negativeWeight:
        sql<number>`coalesce(sum(${weight}) filter (where ${messages.sentiment} = 'négatif'), 0)`.mapWith(
          Number,
        ),
      totalWeight: sql<number>`coalesce(sum(${weight}), 0)`.mapWith(Number),
    })
    .from(messages)
    .where(
      and(
        eq(messages.sentimentStatus, "completed"),
        eq(messages.runId, runId),
        ...dashboardFilterConditions(filters, "ai"),
      ),
    );

  if (!row || row.totalWeight === 0) return null;
  return computeWeightedScore(row.positiveWeight, row.negativeWeight, row.totalWeight);
}
