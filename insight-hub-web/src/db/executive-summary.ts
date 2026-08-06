import { createHash } from "node:crypto";

import { and, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { executiveSummaries } from "@/db/schema";
import type { DashboardFilters } from "@/db/dashboard-filters";

// "Quelques secondes" par design.md : la génération reste dans le budget de
// temps d'une requête HTTP normale, avec dégradation gracieuse au-delà.
const SUMMARY_FETCH_TIMEOUT_MS = 8000;

export type ExecutiveSummaryKpis = {
  netSentimentScore: number | null;
  netSentimentTrend: number | null;
  topRiskTheme: { label: string; score: number; trend: number | null } | null;
  platformDistribution: { label: string; share: number; messageCount: number }[];
  countryDistribution: {
    label: string;
    share: number;
    messageCount: number;
    netScore: number | null;
  }[];
  representativeMessage: { text: string; user: string; platform: string } | null;
  // Volume de messages classés (sentiment + thème) dans le scope courant —
  // proxy peu coûteux à "les données du scope ont changé" (voir design.md,
  // Decision "scope_key = empreinte des filtres actifs + volume classé").
  classifiedCount: number;
};

function filterValue(value: string | number | undefined | null): string {
  return value === undefined || value === null ? "" : String(value);
}

// Symétrique à compute_scope_key côté pipeline (app/summary.py) : mêmes
// champs de filtre (recherche et favoris exclus, cf. dashboard-filters.ts),
// même volume classé, même algorithme de hash (sha256 d'une chaîne
// pipe-delimited à ordre fixe) — pas de run_id ici, l'unicité par run vit
// déjà dans la contrainte `unique(run_id, scope_key)` de la table.
export function computeScopeKey(filters: DashboardFilters, classifiedCount: number): string {
  const parts = [
    filterValue(filters.dateFrom),
    filterValue(filters.dateTo),
    filterValue(filters.platform),
    filterValue(filters.country),
    filterValue(filters.sentiment),
    filterValue(filters.themeId),
    String(classifiedCount),
  ];
  return createHash("sha256").update(parts.join("|"), "utf8").digest("hex");
}

export async function getCachedExecutiveSummary(
  runId: number,
  scopeKey: string,
): Promise<string | null> {
  const [row] = await db
    .select({ summaryText: executiveSummaries.summaryText })
    .from(executiveSummaries)
    .where(and(eq(executiveSummaries.runId, runId), eq(executiveSummaries.scopeKey, scopeKey)));

  return row?.summaryText ?? null;
}

async function callPipelineSummary(
  runId: number,
  filters: DashboardFilters,
  kpis: ExecutiveSummaryKpis,
): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SUMMARY_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(`${process.env.PIPELINE_SERVICE_URL}/api/summary`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PIPELINE_AUTH_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        run_id: runId,
        filters: {
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
          platform: filters.platform,
          country: filters.country,
          sentiment: filters.sentiment,
          themeId: filters.themeId,
        },
        kpis: {
          net_sentiment_score: kpis.netSentimentScore,
          net_sentiment_trend: kpis.netSentimentTrend,
          top_risk_theme: kpis.topRiskTheme,
          platform_distribution: kpis.platformDistribution.map((entry) => ({
            label: entry.label,
            share: entry.share,
            message_count: entry.messageCount,
          })),
          country_distribution: kpis.countryDistribution.map((entry) => ({
            label: entry.label,
            share: entry.share,
            message_count: entry.messageCount,
            net_score: entry.netScore,
          })),
          representative_message: kpis.representativeMessage,
          // Voyage dans kpis plutôt qu'en champ racine pour garder le corps
          // de requête à exactement {run_id, filters, kpis} (voir app/summary.py).
          classified_count: kpis.classifiedCount,
        },
      }),
      signal: controller.signal,
    });

    const data = await response.json().catch(() => null);
    if (!response.ok || !data || data.status !== "ok" || typeof data.summary !== "string") {
      return null;
    }
    return data.summary;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// Dépendances injectables (getCached/callPipeline) plutôt qu'un mock de
// module : ce projet ne mock ni `@/db/*` ni `fetch` dans ses tests
// existants (voir les modules db/*.test.ts, qui testent tous des fonctions
// pures) — même esprit que le paramètre `client=None` de generate_summary
// côté pipeline (app/summary.py), qui permet de substituer un faux client
// Gemini sans bibliothèque de mock.
export async function getExecutiveSummary(
  runId: number,
  filters: DashboardFilters,
  kpis: ExecutiveSummaryKpis,
  deps: {
    getCached?: typeof getCachedExecutiveSummary;
    callPipeline?: typeof callPipelineSummary;
  } = {},
): Promise<string | null> {
  const getCached = deps.getCached ?? getCachedExecutiveSummary;
  const callPipeline = deps.callPipeline ?? callPipelineSummary;

  const scopeKey = computeScopeKey(filters, kpis.classifiedCount);

  try {
    const cached = await getCached(runId, scopeKey);
    if (cached !== null) return cached;
  } catch {
    // La lecture du cache ne doit jamais empêcher une tentative de
    // génération — on retombe sur l'appel pipeline, même logique de
    // dégradation gracieuse que l'échec de callPipelineSummary lui-même.
  }

  try {
    return await callPipeline(runId, filters, kpis);
  } catch {
    return null;
  }
}
