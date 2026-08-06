import { getDashboardFilterOptions } from "@/db/dashboard-filter-options";
import { previousPeriodFilters, type DashboardFilters } from "@/db/dashboard-filters";
import { getEngagementRateBySentiment } from "@/db/engagement-rate";
import { getExecutiveSummary, type ExecutiveSummaryKpis } from "@/db/executive-summary";
import { getLatestImportRun } from "@/db/latest-import-run";
import { getCountryDistribution, getPlatformDistribution } from "@/db/message-distribution";
import {
  getDailyNetSentimentEvolution,
  getNetSentimentScore,
  NET_SENTIMENT_SOURCE,
} from "@/db/net-sentiment-score";
import { getMessageSearchResults } from "@/db/message-search";
import { getRepresentativeMessagesByThemeAndSentiment } from "@/db/representative-messages";
import { getSentimentWordCloud } from "@/db/sentiment-word-cloud";
import { getNetSentimentPeaksWithMessages } from "@/db/sentiment-timeline-peaks";
import { getThemeRanking } from "@/db/theme-ranking";
import { getThemeRiskScoreTrend } from "@/db/theme-risk-score";
import { getWeightedSentimentScore } from "@/db/weighted-sentiment-score";

import { CountryMapCard } from "./country-map-card";
import { DistributionCard } from "./distribution-card";
import { EngagementRateCard } from "./engagement-rate-card";
import { ExecutiveSummaryCard } from "./executive-summary-card";
import { FilterBar } from "./filter-bar";
import { MessageSearchResults } from "./message-search-results";
import { NetSentimentCard } from "./net-sentiment-card";
import { RepresentativeMessagesCard } from "./representative-messages-card";
import { SearchBar } from "./search-bar";
import { SentimentWordCloudCard } from "./sentiment-word-cloud-card";
import { ThemeRiskScoreCard } from "./theme-risk-score-card";
import { TopThemesCard } from "./top-themes-card";
import { WeightedSentimentCard } from "./weighted-sentiment-card";

// Toujours lire les données à la demande : le sentiment se calcule
// automatiquement en tâche de fond juste après l'import (voir
// ai-sentiment-analysis), donc la page ne doit jamais servir un rendu mis en
// cache qui daterait d'avant cette classification.
export const dynamic = "force-dynamic";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SENTIMENT_VALUES = new Set(["positif", "négatif", "neutre"]);

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseDate(value: string | undefined): string | undefined {
  if (!value || !DATE_PATTERN.test(value)) return undefined;
  return Number.isNaN(new Date(value).getTime()) ? undefined : value;
}

function parseDashboardFilters(searchParams: SearchParams): DashboardFilters {
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
  };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const filters = parseDashboardFilters(await searchParams);
  const latestRun = await getLatestImportRun();
  const runId = latestRun?.id ?? null;

  // Fenêtre "période précédente équivalente" pour la comparaison temporelle
  // du score net (voir net-sentiment-temporal-comparison) : null tant que
  // le filtre de période n'est pas complet, la comparaison n'a alors pas de
  // sens (voir design.md §2).
  const previousFilters = previousPeriodFilters(filters);

  const [
    score,
    previousScore,
    evolution,
    platforms,
    countries,
    filterOptions,
    engagementRates,
    weightedScore,
    themeRanking,
    themeRiskScores,
    representativeMessages,
    sentimentWordCloud,
  ] = await Promise.all([
    getNetSentimentScore(runId, filters),
    previousFilters ? getNetSentimentScore(runId, previousFilters) : Promise.resolve(null),
    getDailyNetSentimentEvolution(runId, filters),
    getPlatformDistribution(runId, filters),
    getCountryDistribution(runId, filters),
    getDashboardFilterOptions(runId),
    getEngagementRateBySentiment(runId, filters),
    getWeightedSentimentScore(runId, filters),
    getThemeRanking(runId, filters),
    getThemeRiskScoreTrend(runId, filters),
    getRepresentativeMessagesByThemeAndSentiment(runId, filters),
    getSentimentWordCloud(runId, filters),
  ]);

  const peaks = await getNetSentimentPeaksWithMessages(runId, evolution, filters);

  const isSearchActive = Boolean(filters.query?.trim()) || Boolean(filters.favoritesOnly);
  const searchResults = isSearchActive ? await getMessageSearchResults(runId, filters) : null;

  // Appelée séparément du Promise.all ci-dessus (pas dans le même lot) pour
  // ne pas ralentir l'affichage des autres KPIs si la génération est lente
  // (voir design.md, Decision "Dégradation gracieuse synchrone").
  const summaryKpis = buildSummaryKpis({
    score,
    previousScore,
    themeRiskScores,
    platforms,
    countries,
    representativeMessages,
  });
  const summary = runId !== null ? await getExecutiveSummary(runId, filters, summaryKpis) : null;

  return (
    <main className="dashboard-main">
      <div className="dashboard-grid">
        {latestRun ? (
          <p className="dashboard-scope">
            Basé sur le dernier import : <strong>{latestRun.keyword}</strong> (
            {latestRun.sourceFilename}, {formatDate(latestRun.startedAt)})
          </p>
        ) : (
          <p className="empty-state">Aucun import réalisé pour l&apos;instant.</p>
        )}
        <FilterBar options={filterOptions} />
        <SearchBar />
        {searchResults && (
          <MessageSearchResults
            results={searchResults.results}
            totalCount={searchResults.totalCount}
            isTruncated={searchResults.isTruncated}
          />
        )}
        <ExecutiveSummaryCard hasImport={latestRun !== null} summary={summary} />
        <NetSentimentCard
          score={score}
          evolution={evolution}
          peaks={peaks}
          source={NET_SENTIMENT_SOURCE}
          previousScore={previousScore}
          previousDateFrom={previousFilters?.dateFrom ?? null}
          previousDateTo={previousFilters?.dateTo ?? null}
        />
        <div className="dashboard-grid dashboard-grid--split">
          <DistributionCard
            kicker="Répartition"
            title="Messages par plateforme"
            emptyMessage="Aucun message importé pour l'instant."
            entries={platforms}
          />
          <CountryMapCard entries={countries} />
        </div>
        <EngagementRateCard entries={engagementRates} />
        <WeightedSentimentCard score={weightedScore} />
        <TopThemesCard entries={themeRanking} />
        <ThemeRiskScoreCard entries={themeRiskScores} />
        <RepresentativeMessagesCard entries={representativeMessages} />
        <SentimentWordCloudCard entries={sentimentWordCloud} />
      </div>
    </main>
  );
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(date);
}

// Assemble le payload KPIs envoyé au résumé exécutif à partir des KPIs déjà
// calculés ci-dessus par le Promise.all (lecture seule, aucun nouveau
// calcul) — voir design.md, Goal "le résumé ne relit jamais les messages
// bruts et ne relance jamais de classification".
function buildSummaryKpis({
  score,
  previousScore,
  themeRiskScores,
  platforms,
  countries,
  representativeMessages,
}: {
  score: number | null;
  previousScore: number | null;
  themeRiskScores: Awaited<ReturnType<typeof getThemeRiskScoreTrend>>;
  platforms: Awaited<ReturnType<typeof getPlatformDistribution>>;
  countries: Awaited<ReturnType<typeof getCountryDistribution>>;
  representativeMessages: Awaited<ReturnType<typeof getRepresentativeMessagesByThemeAndSentiment>>;
}): ExecutiveSummaryKpis {
  // Premier de themeRiskScores (déjà trié décroissant par score, voir
  // buildThemeRiskScores) : le thème le plus à risque du scope courant.
  const topRiskThemeEntry = themeRiskScores[0] ?? null;

  // Volume classé (sentiment + thème) dans le scope courant : la somme des
  // messageCount par thème couvre exactement les messages classés sur les
  // deux axes (voir buildThemeRiskScores, qui n'incrémente messageCount que
  // pour themeStatus/sentimentStatus 'completed') — évite une requête DB
  // dédiée pour ce seul besoin de cache.
  const classifiedCount = themeRiskScores.reduce((sum, entry) => sum + entry.messageCount, 0);

  const topRiskThemeMessages = topRiskThemeEntry
    ? representativeMessages.find((entry) => entry.themeId === topRiskThemeEntry.themeId)
    : undefined;
  const representativeMessage = topRiskThemeMessages?.bySentiment.négatif ?? null;

  return {
    netSentimentScore: score,
    netSentimentTrend: score !== null && previousScore !== null ? score - previousScore : null,
    topRiskTheme:
      topRiskThemeEntry && topRiskThemeEntry.messageCount > 0
        ? {
            label: topRiskThemeEntry.label,
            score: topRiskThemeEntry.score,
            trend: topRiskThemeEntry.trend,
          }
        : null,
    platformDistribution: platforms.map((entry) => ({
      label: entry.label,
      share: entry.share,
      messageCount: entry.messageCount,
    })),
    countryDistribution: countries.map((entry) => ({
      label: entry.label,
      share: entry.share,
      messageCount: entry.messageCount,
      netScore: entry.netScore,
    })),
    representativeMessage: representativeMessage
      ? {
          text: representativeMessage.text,
          user: representativeMessage.user,
          platform: representativeMessage.platform,
        }
      : null,
    classifiedCount,
  };
}
