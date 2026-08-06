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
  query?: string;
  favoritesOnly?: boolean;
  compareKeyword?: string;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const SENTIMENT_VALUES = new Set(["positif", "négatif", "neutre"]);

export type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseDate(value: string | undefined): string | undefined {
  if (!value || !DATE_PATTERN.test(value)) return undefined;
  return Number.isNaN(new Date(value).getTime()) ? undefined : value;
}

// Extraite de dashboard/page.tsx pour être réutilisée à l'identique par la
// route d'export PDF (voir pdf-export, design.md, Decision "Filtres
// partagés entre dashboard et export") — évite une divergence de parsing
// entre les deux entrées.
export function parseDashboardFilters(searchParams: SearchParams): DashboardFilters {
  const sentiment = first(searchParams.sentiment);
  const themeId = first(searchParams.themeId);
  const parsedThemeId = themeId !== undefined ? Number.parseInt(themeId, 10) : NaN;

  return {
    dateFrom: parseDate(first(searchParams.dateFrom)),
    dateTo: parseDate(first(searchParams.dateTo)),
    platform: first(searchParams.platform) || undefined,
    country: first(searchParams.country) || undefined,
    sentiment: sentiment && SENTIMENT_VALUES.has(sentiment)
      ? (sentiment as DashboardFilters["sentiment"])
      : undefined,
    themeId: Number.isInteger(parsedThemeId) ? parsedThemeId : undefined,
    query: first(searchParams.q) || undefined,
    favoritesOnly: first(searchParams.favorisUniquement) === "1",
    compareKeyword: first(searchParams.compareKeyword) || undefined,
  };
}

function parseUtcCalendarDate(value: string): Date | null {
  if (!DATE_PATTERN.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatUtcCalendarDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Dérive la fenêtre "période précédente équivalente" (même durée en jours
// calendaires, se terminant la veille de dateFrom) à partir du filtre de
// période actif — voir la capacité net-sentiment-temporal-comparison,
// Requirement: Previous Equivalent Period Derived From Active Period
// Filter. Retourne null si dateFrom/dateTo est manquant, invalide, ou
// incohérent (dateTo avant dateFrom) : la comparaison n'a alors pas de sens
// (voir Requirement: Comparison Unavailable Without A Complete Period
// Filter). Générique aux autres dimensions de filtre (plateforme, pays,
// sentiment, thème), qui restent inchangées dans le résultat.
export function previousPeriodFilters(filters: DashboardFilters): DashboardFilters | null {
  if (!filters.dateFrom || !filters.dateTo) return null;

  const from = parseUtcCalendarDate(filters.dateFrom);
  const to = parseUtcCalendarDate(filters.dateTo);
  if (!from || !to || to.getTime() < from.getTime()) return null;

  const lengthInDays = Math.round((to.getTime() - from.getTime()) / MS_PER_DAY) + 1;
  const previousDateTo = new Date(from.getTime() - MS_PER_DAY);
  const previousDateFrom = new Date(previousDateTo.getTime() - (lengthInDays - 1) * MS_PER_DAY);

  return {
    ...filters,
    dateFrom: formatUtcCalendarDate(previousDateFrom),
    dateTo: formatUtcCalendarDate(previousDateTo),
  };
}

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

// Non incluses dans dashboardFilterConditions à dessein : la recherche et le
// filtre favoris ne doivent pas s'appliquer aux KPIs agrégés existants (voir
// proposal.md de add-search-favorites-dashboard, capacité dashboard-cross-filters
// non modifiée) — seule la liste de résultats de message-search.ts les combine.
export function searchCondition(filters: DashboardFilters): SQL | undefined {
  const query = filters.query?.trim();
  if (!query) return undefined;
  return sql`${messages.searchVector} @@ websearch_to_tsquery('simple', ${query})`;
}

export function favoritesCondition(filters: DashboardFilters): SQL | undefined {
  if (!filters.favoritesOnly) return undefined;
  return eq(messages.isFavorite, true);
}

export function dashboardFilterConditions(
  filters: DashboardFilters,
  sentimentSource: "ai" | "csv_original",
  options?: { includeTheme?: boolean },
): SQL[] {
  const includeTheme = options?.includeTheme ?? true;

  return [
    dateRangeCondition(filters),
    platformCondition(filters),
    countryCondition(filters),
    includeTheme ? themeCondition(filters) : undefined,
    sentimentCondition(filters, sentimentSource),
  ].filter((condition): condition is SQL => condition !== undefined);
}
