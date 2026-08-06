import { and, eq, type SQL } from "drizzle-orm";

import { db } from "@/db/client";
import { messages, themes } from "@/db/schema";
import { dashboardFilterConditions, type DashboardFilters } from "@/db/dashboard-filters";
import { CATEGORY_TO_LABEL, isSentimentLabel, type SentimentLabel } from "@/db/engagement-rate";
import { NET_SENTIMENT_SOURCE } from "@/db/net-sentiment-score";
import { mapOriginalSentimentToCategory } from "@/db/original-sentiment-mapping";

export type RepresentativeMessage = {
  id: number;
  text: string;
  user: string;
  platform: string;
  timestamp: Date;
  likes: number | null;
  retweets: number | null;
  isFavorite: boolean;
};

export type ThemeRepresentativeMessages = {
  themeId: number;
  label: string;
  bySentiment: Record<SentimentLabel, RepresentativeMessage | null>;
};

export const SENTIMENT_LABELS: readonly SentimentLabel[] = ["positif", "négatif", "neutre"];

function emptyBySentiment(): Record<SentimentLabel, RepresentativeMessage | null> {
  return { positif: null, négatif: null, neutre: null };
}

// Même critère que le message représentatif d'un pic de sentiment (voir
// sentiment-timeline-peaks.ts, getRepresentativeMessage) : somme likes +
// retweets la plus grande, valeur nulle traitée comme 0, égalité départagée
// par l'identifiant le plus petit. Exportée pure pour rester testable sans
// base de données.
export function engagementScore(likes: number | null, retweets: number | null): number {
  return (likes ?? 0) + (retweets ?? 0);
}

export function isMoreRepresentative(
  candidate: RepresentativeMessage,
  current: RepresentativeMessage | null,
): boolean {
  if (!current) return true;
  const candidateScore = engagementScore(candidate.likes, candidate.retweets);
  const currentScore = engagementScore(current.likes, current.retweets);
  if (candidateScore !== currentScore) return candidateScore > currentScore;
  return candidate.id < current.id;
}

type ClassifiedRow = {
  sentiment: string | null;
  sentimentOriginal: string | null;
};

// Même source de sentiment que le score net (voir net-sentiment-score.ts) :
// classification IA si active, mapping provisoire de sentiment_original sinon.
// Exportée pure pour rester testable sans base de données.
export function resolveSentimentLabel(
  sentimentSource: "ai" | "csv_original",
  row: ClassifiedRow,
): SentimentLabel | null {
  if (sentimentSource === "ai") {
    return isSentimentLabel(row.sentiment) ? row.sentiment : null;
  }

  const category = mapOriginalSentimentToCategory(row.sentimentOriginal);
  return category ? CATEGORY_TO_LABEL[category] : null;
}

export async function getRepresentativeMessagesByThemeAndSentiment(
  runId: number | null,
  filters: DashboardFilters,
): Promise<ThemeRepresentativeMessages[]> {
  const themeRows = await db
    .select({ id: themes.id, label: themes.label })
    .from(themes)
    .orderBy(themes.id);

  const byTheme = new Map<number, ThemeRepresentativeMessages>(
    themeRows.map((theme) => [
      theme.id,
      { themeId: theme.id, label: theme.label, bySentiment: emptyBySentiment() },
    ]),
  );

  if (runId === null) return Array.from(byTheme.values());

  const conditions = [
    eq(messages.runId, runId),
    eq(messages.themeStatus, "completed"),
    NET_SENTIMENT_SOURCE === "ai" ? eq(messages.sentimentStatus, "completed") : undefined,
    ...dashboardFilterConditions(filters, NET_SENTIMENT_SOURCE),
  ].filter((condition): condition is SQL => condition !== undefined);

  const rows = await db
    .select({
      themeId: messages.themeId,
      sentiment: messages.sentiment,
      sentimentOriginal: messages.sentimentOriginal,
      id: messages.id,
      text: messages.text,
      user: messages.user,
      platform: messages.platform,
      timestamp: messages.timestamp,
      likes: messages.likes,
      retweets: messages.retweets,
      isFavorite: messages.isFavorite,
    })
    .from(messages)
    .where(and(...conditions));

  for (const row of rows) {
    if (row.themeId === null) continue;
    const entry = byTheme.get(row.themeId);
    if (!entry) continue;

    const label = resolveSentimentLabel(NET_SENTIMENT_SOURCE, row);
    if (!label) continue;

    const candidate: RepresentativeMessage = {
      id: row.id,
      text: row.text,
      user: row.user,
      platform: row.platform,
      timestamp: row.timestamp,
      likes: row.likes,
      retweets: row.retweets,
      isFavorite: row.isFavorite,
    };

    if (isMoreRepresentative(candidate, entry.bySentiment[label])) {
      entry.bySentiment[label] = candidate;
    }
  }

  return Array.from(byTheme.values());
}
