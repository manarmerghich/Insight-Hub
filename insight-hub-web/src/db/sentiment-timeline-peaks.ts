import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { messages } from "@/db/schema";
import { dashboardFilterConditions, type DashboardFilters } from "@/db/dashboard-filters";
import type { DailyNetSentiment } from "@/db/net-sentiment-score";

const PEAK_THRESHOLD_STDDEV = 2;
const MIN_SAMPLE_SIZE = 5;

export type PeakDirection = "positive" | "negative";

export type NetSentimentPeak = {
  date: string;
  netScore: number;
  direction: PeakDirection;
  deviationFromMean: number;
};

export function detectNetSentimentPeaks(evolution: DailyNetSentiment[]): NetSentimentPeak[] {
  if (evolution.length < MIN_SAMPLE_SIZE) return [];

  const mean =
    evolution.reduce((sum, day) => sum + day.netScore, 0) / evolution.length;
  const variance =
    evolution.reduce((sum, day) => sum + (day.netScore - mean) ** 2, 0) / evolution.length;
  const stddev = Math.sqrt(variance);

  if (stddev === 0) return [];

  const peaks: NetSentimentPeak[] = [];
  for (const day of evolution) {
    const deviationFromMean = day.netScore - mean;
    if (Math.abs(deviationFromMean) <= PEAK_THRESHOLD_STDDEV * stddev) continue;

    peaks.push({
      date: day.date,
      netScore: day.netScore,
      direction: deviationFromMean > 0 ? "positive" : "negative",
      deviationFromMean,
    });
  }

  return peaks;
}

export type RepresentativeMessage = {
  date: string;
  text: string;
  user: string;
  platform: string;
  timestamp: Date;
};

const DIRECTION_TO_SENTIMENT: Record<PeakDirection, "positif" | "négatif"> = {
  positive: "positif",
  negative: "négatif",
};

async function getRepresentativeMessage(
  runId: number,
  date: string,
  direction: PeakDirection,
  filters: DashboardFilters,
): Promise<RepresentativeMessage | null> {
  const dayStart = new Date(`${date}T00:00:00.000Z`);
  const dayEnd = new Date(`${date}T23:59:59.999Z`);
  const engagement = sql`coalesce(${messages.likes}, 0) + coalesce(${messages.retweets}, 0)`;

  const [row] = await db
    .select({
      text: messages.text,
      user: messages.user,
      platform: messages.platform,
      timestamp: messages.timestamp,
    })
    .from(messages)
    .where(
      and(
        eq(messages.runId, runId),
        eq(messages.sentimentStatus, "completed"),
        eq(messages.sentiment, DIRECTION_TO_SENTIMENT[direction]),
        gte(messages.timestamp, dayStart),
        lte(messages.timestamp, dayEnd),
        ...dashboardFilterConditions(filters, "ai"),
      ),
    )
    .orderBy(desc(engagement), asc(messages.id))
    .limit(1);

  if (!row) return null;
  return { date, ...row };
}

export type NetSentimentPeakWithMessage = NetSentimentPeak & {
  representativeMessage: RepresentativeMessage | null;
};

export async function getNetSentimentPeaksWithMessages(
  runId: number | null,
  evolution: DailyNetSentiment[],
  filters: DashboardFilters,
): Promise<NetSentimentPeakWithMessage[]> {
  const peaks = detectNetSentimentPeaks(evolution);
  if (runId === null || peaks.length === 0) return peaks.map((peak) => ({
    ...peak,
    representativeMessage: null,
  }));

  return Promise.all(
    peaks.map(async (peak) => ({
      ...peak,
      representativeMessage: await getRepresentativeMessage(
        runId,
        peak.date,
        peak.direction,
        filters,
      ),
    })),
  );
}
