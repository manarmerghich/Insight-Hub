import { and, asc, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { messages } from "@/db/schema";
import {
  dashboardFilterConditions,
  favoritesCondition,
  searchCondition,
  type DashboardFilters,
} from "@/db/dashboard-filters";
import { NET_SENTIMENT_SOURCE } from "@/db/net-sentiment-score";

export const MESSAGE_SEARCH_RESULT_CAP = 50;

export type SortMode = "relevance" | "recency";

export function resolveSortMode(filters: DashboardFilters): SortMode {
  return filters.query?.trim() ? "relevance" : "recency";
}

export function isResultCapExceeded(totalCount: number): boolean {
  return totalCount > MESSAGE_SEARCH_RESULT_CAP;
}

export type MessageSearchResult = {
  id: number;
  text: string;
  user: string;
  platform: string;
  timestamp: Date;
  sentiment: string | null;
  isFavorite: boolean;
};

export type MessageSearchResults = {
  results: MessageSearchResult[];
  totalCount: number;
  isTruncated: boolean;
};

export async function getMessageSearchResults(
  runId: number | null,
  filters: DashboardFilters,
): Promise<MessageSearchResults> {
  if (runId === null) return { results: [], totalCount: 0, isTruncated: false };

  const conditions = [
    eq(messages.runId, runId),
    ...dashboardFilterConditions(filters, NET_SENTIMENT_SOURCE),
    searchCondition(filters),
    favoritesCondition(filters),
  ].filter((condition): condition is NonNullable<typeof condition> => condition !== undefined);

  const query = filters.query?.trim();
  const orderBy =
    resolveSortMode(filters) === "relevance"
      ? [desc(sql`ts_rank(${messages.searchVector}, websearch_to_tsquery('simple', ${query}))`), asc(messages.id)]
      : [desc(messages.timestamp), asc(messages.id)];

  const [rows, [{ totalCount }]] = await Promise.all([
    db
      .select({
        id: messages.id,
        text: messages.text,
        user: messages.user,
        platform: messages.platform,
        timestamp: messages.timestamp,
        sentiment: messages.sentiment,
        isFavorite: messages.isFavorite,
      })
      .from(messages)
      .where(and(...conditions))
      .orderBy(...orderBy)
      .limit(MESSAGE_SEARCH_RESULT_CAP),
    db
      .select({ totalCount: sql<number>`count(*)`.mapWith(Number) })
      .from(messages)
      .where(and(...conditions)),
  ]);

  return {
    results: rows,
    totalCount,
    isTruncated: isResultCapExceeded(totalCount),
  };
}
