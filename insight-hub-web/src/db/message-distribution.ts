import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { messages } from "@/db/schema";
import {
  dashboardFilterConditions,
  UNKNOWN_COUNTRY_LABEL,
  type DashboardFilters,
} from "@/db/dashboard-filters";
import { computeNetScore, NET_SENTIMENT_SOURCE } from "@/db/net-sentiment-score";
import { resolveSentimentLabel } from "@/db/representative-messages";

export { UNKNOWN_COUNTRY_LABEL } from "@/db/dashboard-filters";

export type DistributionEntry = {
  label: string;
  messageCount: number;
  share: number;
};

export type CountryDistributionEntry = DistributionEntry & {
  netScore: number | null;
};

function withShares<T extends { label: string; messageCount: number }>(
  rows: T[],
): (T & { share: number })[] {
  const total = rows.reduce((sum, row) => sum + row.messageCount, 0);
  return rows.map((row) => ({
    ...row,
    share: total > 0 ? row.messageCount / total : 0,
  }));
}

export async function getPlatformDistribution(
  runId: number | null,
  filters: DashboardFilters,
): Promise<DistributionEntry[]> {
  if (runId === null) return [];

  const rows = await db
    .select({
      label: messages.platform,
      messageCount: sql<number>`count(*)`.mapWith(Number),
    })
    .from(messages)
    .where(
      and(eq(messages.runId, runId), ...dashboardFilterConditions(filters, NET_SENTIMENT_SOURCE)),
    )
    .groupBy(messages.platform)
    .orderBy(desc(sql`count(*)`));

  return withShares(rows);
}

// Score de sentiment net par pays : même formule et même branchement
// NET_SENTIMENT_SOURCE ("ai" / "csv_original") que getNetSentimentScore
// (net-sentiment-score.ts) / getEngagementRateBySentiment
// (engagement-rate.ts), voir design.md §3. `null` pour un pays sans message
// classé — même convention que le score net global, jamais un score à zéro.
export type CountrySentimentRow = {
  country: string | null;
  sentiment: string | null;
  sentimentOriginal: string | null;
};

type CountryBucket = {
  messageCount: number;
  positive: number;
  negative: number;
  classified: number;
};

// Agrégation pure (regroupement par pays, calcul du score net, tri par
// volume décroissant) : séparée de la requête DB pour rester testable sans
// base de données, à l'image de tokenize/rankWordFrequencies
// (sentiment-word-cloud.ts).
export function buildCountryDistribution(
  rows: CountrySentimentRow[],
  sentimentSource: "ai" | "csv_original",
): CountryDistributionEntry[] {
  const byLabel = new Map<string, CountryBucket>();
  for (const row of rows) {
    const label = row.country?.trim() ? row.country.trim() : UNKNOWN_COUNTRY_LABEL;
    const bucket = byLabel.get(label) ?? { messageCount: 0, positive: 0, negative: 0, classified: 0 };

    bucket.messageCount++;
    const sentimentLabel = resolveSentimentLabel(sentimentSource, row);
    if (sentimentLabel) {
      bucket.classified++;
      if (sentimentLabel === "positif") bucket.positive++;
      else if (sentimentLabel === "négatif") bucket.negative++;
    }

    byLabel.set(label, bucket);
  }

  const merged = Array.from(byLabel, ([label, bucket]) => ({
    label,
    messageCount: bucket.messageCount,
    netScore:
      bucket.classified > 0
        ? computeNetScore(bucket.positive, bucket.negative, bucket.classified)
        : null,
  })).sort((a, b) => b.messageCount - a.messageCount);

  return withShares(merged);
}

export async function getCountryDistribution(
  runId: number | null,
  filters: DashboardFilters,
): Promise<CountryDistributionEntry[]> {
  if (runId === null) return [];

  const rows: CountrySentimentRow[] = await db
    .select({
      country: messages.country,
      sentiment: messages.sentiment,
      sentimentOriginal: messages.sentimentOriginal,
    })
    .from(messages)
    .where(
      and(eq(messages.runId, runId), ...dashboardFilterConditions(filters, NET_SENTIMENT_SOURCE)),
    );

  return buildCountryDistribution(rows, NET_SENTIMENT_SOURCE);
}
