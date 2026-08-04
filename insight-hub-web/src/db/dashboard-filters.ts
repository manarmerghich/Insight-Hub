import { and, eq, gte, inArray, isNull, lte, not, or, sql, type SQL } from "drizzle-orm";

import { messages } from "@/db/schema";
import { NEGATIVE_LABELS, POSITIVE_LABELS } from "@/db/original-sentiment-mapping";

// Défini ici plutôt que dans message-distribution.ts pour éviter un cycle
// d'imports : message-distribution.ts dépend déjà de ce module pour les
// conditions de filtre, message-distribution.ts importe donc cette constante
// depuis ici plutôt que l'inverse.
export const UNKNOWN_COUNTRY_LABEL = "Non renseigné";

export type DashboardFilters = {
  dateFrom?: string;
  dateTo?: string;
  platform?: string;
  country?: string;
  sentiment?: "positif" | "négatif" | "neutre";
  themeId?: number;
};

export function dateRangeCondition(filters: DashboardFilters): SQL | undefined {
  const conditions: SQL[] = [];

  if (filters.dateFrom) {
    const from = new Date(`${filters.dateFrom}T00:00:00.000Z`);
    if (!Number.isNaN(from.getTime())) conditions.push(gte(messages.timestamp, from));
  }
  if (filters.dateTo) {
    const to = new Date(`${filters.dateTo}T23:59:59.999Z`);
    if (!Number.isNaN(to.getTime())) conditions.push(lte(messages.timestamp, to));
  }

  if (conditions.length === 0) return undefined;
  return and(...conditions);
}

export function platformCondition(filters: DashboardFilters): SQL | undefined {
  if (!filters.platform) return undefined;
  return eq(messages.platform, filters.platform);
}

export function countryCondition(filters: DashboardFilters): SQL | undefined {
  if (!filters.country) return undefined;
  if (filters.country === UNKNOWN_COUNTRY_LABEL) {
    return or(isNull(messages.country), eq(sql`trim(${messages.country})`, ""));
  }
  return eq(messages.country, filters.country);
}

export function themeCondition(filters: DashboardFilters): SQL | undefined {
  if (filters.themeId === undefined) return undefined;
  return and(eq(messages.themeId, filters.themeId), eq(messages.themeStatus, "completed"));
}

export function sentimentCondition(
  filters: DashboardFilters,
  source: "ai" | "csv_original",
): SQL | undefined {
  if (!filters.sentiment) return undefined;

  if (source === "ai") {
    return and(
      eq(messages.sentimentStatus, "completed"),
      eq(messages.sentiment, filters.sentiment),
    );
  }

  const normalizedOriginal = sql`lower(trim(${messages.sentimentOriginal}))`;
  if (filters.sentiment === "positif") return inArray(normalizedOriginal, [...POSITIVE_LABELS]);
  if (filters.sentiment === "négatif") return inArray(normalizedOriginal, [...NEGATIVE_LABELS]);
  return not(inArray(normalizedOriginal, [...POSITIVE_LABELS, ...NEGATIVE_LABELS]));
}

export function dashboardFilterConditions(
  filters: DashboardFilters,
  sentimentSource: "ai" | "csv_original",
): SQL[] {
  return [
    dateRangeCondition(filters),
    platformCondition(filters),
    countryCondition(filters),
    themeCondition(filters),
    sentimentCondition(filters, sentimentSource),
  ].filter((condition): condition is SQL => condition !== undefined);
}
