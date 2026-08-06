import { and, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { messages, themes } from "@/db/schema";
import {
  dashboardFilterConditions,
  previousPeriodFilters,
  type DashboardFilters,
} from "@/db/dashboard-filters";

export type ThemeRiskScoreEntry = {
  themeId: number;
  label: string;
  messageCount: number;
  negativeCount: number;
  score: number;
  trend: number | null;
};

export type ThemeRow = {
  id: number;
  label: string;
};

// Une ligne par message du scope courant (déjà restreint par runId et les
// filtres croisés hors thème via dashboardFilterConditions), avant filtrage
// theme_status/sentiment_status : ce filtrage se fait dans buildThemeRiskScores
// pour rester testable sans base de données (voir CountrySentimentRow /
// buildCountryDistribution dans message-distribution.ts).
export type ThemeRiskScoreMessageRow = {
  themeId: number | null;
  themeStatus: string;
  sentiment: string | null;
  sentimentStatus: string;
};

// score = (part du volume classé du thème parmi tous les thèmes) × (part de
// négatif au sein du thème) × 100, arrondi comme computeNetScore (voir
// net-sentiment-score.ts) pour rester cohérent avec les autres pourcentages
// déjà affichés sur le dashboard. Un thème sans message classé dans ce scope
// (messageCount = 0) obtient un score de 0 plutôt qu'une division par zéro
// (voir design.md, Decision 1 et 2).
export function computeThemeRiskScore(
  messageCount: number,
  negativeCount: number,
  totalMessagesClassifies: number,
): number {
  if (messageCount === 0 || totalMessagesClassifies === 0) return 0;

  const volumeShare = messageCount / totalMessagesClassifies;
  const negativeShare = negativeCount / messageCount;
  return Math.round(volumeShare * negativeShare * 100);
}

// Agrégation pure (regroupement par thème, intersection theme_status/
// sentiment_status = 'completed', calcul du score, tri décroissant) :
// séparée de la requête DB pour rester testable sans base de données, à
// l'image de buildCountryDistribution (message-distribution.ts). Un thème du
// référentiel sans message dans ce scope apparaît tout de même avec un score
// à 0 (voir design.md, Decision 2) — allThemes en est la source de vérité,
// pas les seuls thèmes présents dans messageRows.
export function buildThemeRiskScores(
  allThemes: ThemeRow[],
  messageRows: ThemeRiskScoreMessageRow[],
): ThemeRiskScoreEntry[] {
  const byThemeId = new Map<number, { messageCount: number; negativeCount: number }>();
  let total = 0;

  for (const row of messageRows) {
    if (row.themeId === null) continue;
    // Un message classé sur un seul des deux axes (thème OU sentiment) est
    // exclu à la fois du compte du thème et du total tous thèmes confondus
    // (voir design.md, Decision 2) : les deux dénominateurs de la formule
    // doivent rester cohérents entre eux.
    if (row.themeStatus !== "completed" || row.sentimentStatus !== "completed") continue;

    const bucket = byThemeId.get(row.themeId) ?? { messageCount: 0, negativeCount: 0 };
    bucket.messageCount++;
    if (row.sentiment === "négatif") bucket.negativeCount++;
    byThemeId.set(row.themeId, bucket);
    total++;
  }

  return allThemes
    .map((theme) => {
      const bucket = byThemeId.get(theme.id) ?? { messageCount: 0, negativeCount: 0 };
      return {
        themeId: theme.id,
        label: theme.label,
        messageCount: bucket.messageCount,
        negativeCount: bucket.negativeCount,
        score: computeThemeRiskScore(bucket.messageCount, bucket.negativeCount, total),
        trend: null as number | null,
      };
    })
    .sort((a, b) => b.score - a.score);
}

// Ignore la dimension de filtre croisé thème (includeTheme: false), même
// pattern que theme-ranking.ts : un thème sélectionné dans les filtres ne
// doit pas réduire ce classement comparatif à une seule ligne (voir
// dashboard-cross-filters, Requirement: Theme Filter Dimension Excluded
// From Theme Ranking).
export async function getThemeRiskScores(
  runId: number | null,
  filters: DashboardFilters,
): Promise<ThemeRiskScoreEntry[]> {
  if (runId === null) return [];

  const [allThemes, messageRows] = await Promise.all([
    db.select({ id: themes.id, label: themes.label }).from(themes),
    db
      .select({
        themeId: messages.themeId,
        themeStatus: messages.themeStatus,
        sentiment: messages.sentiment,
        sentimentStatus: messages.sentimentStatus,
      })
      .from(messages)
      .where(
        and(eq(messages.runId, runId), ...dashboardFilterConditions(filters, "ai", { includeTheme: false })),
      ),
  ]);

  return buildThemeRiskScores(allThemes, messageRows);
}

// Fusionne le score courant et le score de la période précédente équivalente
// en un delta signé par thème : previous === null signifie qu'aucune fenêtre
// précédente n'est calculable (filtre de période absent/incomplet), auquel
// cas aucune tendance n'est attachée. Un thème absent de previous
// (théoriquement impossible puisque getThemeRiskScores couvre toujours tous
// les thèmes du référentiel) reste défensivement traité comme "non
// calculable" plutôt que de fausser le delta.
export function mergeThemeRiskScoreTrend(
  current: ThemeRiskScoreEntry[],
  previous: ThemeRiskScoreEntry[] | null,
): ThemeRiskScoreEntry[] {
  if (previous === null) return current;

  const previousScoreByThemeId = new Map(previous.map((entry) => [entry.themeId, entry.score]));

  return current.map((entry) => {
    const previousScore = previousScoreByThemeId.get(entry.themeId);
    return {
      ...entry,
      trend: previousScore === undefined ? null : entry.score - previousScore,
    };
  });
}

// Tendance par thème = écart signé vs la période précédente équivalente,
// même mécanique que net-sentiment-temporal-comparison : uniquement calculée
// quand previousPeriodFilters(filters) retourne une fenêtre valide (donc
// seulement si dateFrom/dateTo sont actifs et complets).
export async function getThemeRiskScoreTrend(
  runId: number | null,
  filters: DashboardFilters,
): Promise<ThemeRiskScoreEntry[]> {
  const current = await getThemeRiskScores(runId, filters);

  const previousFilters = previousPeriodFilters(filters);
  const previous = previousFilters ? await getThemeRiskScores(runId, previousFilters) : null;

  return mergeThemeRiskScoreTrend(current, previous);
}
