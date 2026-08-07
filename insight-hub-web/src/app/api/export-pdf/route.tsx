import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";

import { computeScopeKey, getCachedExecutiveSummary } from "@/db/executive-summary";
import { parseDashboardFilters, type SearchParams } from "@/db/dashboard-filters";
import { getLatestImportRun } from "@/db/latest-import-run";
import { getCountryDistribution, getPlatformDistribution } from "@/db/message-distribution";
import { getMessageSearchResults } from "@/db/message-search";
import { getDailyNetSentimentEvolution, getNetSentimentScore } from "@/db/net-sentiment-score";
import { getThemeRiskScores } from "@/db/theme-risk-score";
import { getCurrentVisitorId } from "@/lib/visitor";

import { ExportDocument } from "@/app/dashboard/pdf/ExportDocument";

// @react-pdf/renderer importe fs/Buffer côté Node (voir design.md, Decision
// "Route serveur dédiée GET /api/export-pdf, exécution Node.js") —
// incompatible avec l'Edge Runtime. Valeur par défaut, déclarée explicitement.
export const runtime = "nodejs";

function toSearchParams(url: URL): SearchParams {
  const result: SearchParams = {};
  for (const key of url.searchParams.keys()) {
    const values = url.searchParams.getAll(key);
    result[key] = values.length > 1 ? values : values[0];
  }
  return result;
}

function formatFilenameDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const filters = parseDashboardFilters(toSearchParams(url));

  const visitorId = await getCurrentVisitorId();
  const latestRun = await getLatestImportRun(visitorId);
  const runId = latestRun?.id ?? null;

  // Aucun import réalisé : erreur explicite plutôt qu'un PDF vide (voir
  // pdf-export, Requirement "Trigger PDF Export From Current Dashboard
  // Scope", Scenario "Export sans import réalisé").
  if (runId === null) {
    return NextResponse.json(
      { error: "Aucun import réalisé pour l'instant : export impossible." },
      { status: 404 },
    );
  }

  try {
    const [themeRiskScores, score, evolution, platforms, countries, favoritesResult] =
      await Promise.all([
        // Sert uniquement à reconstruire classifiedCount à l'identique du
        // dashboard (voir buildSummaryKpis, dashboard/page.tsx) pour que le
        // scopeKey calculé ici retrouve le résumé déjà mis en cache lors de
        // l'affichage du dashboard sur ce même scope — pas affiché dans le PDF
        // (voir design.md, Non-Goals).
        getThemeRiskScores(runId, filters),
        getNetSentimentScore(runId, filters),
        getDailyNetSentimentEvolution(runId, filters),
        getPlatformDistribution(runId, filters),
        getCountryDistribution(runId, filters),
        getMessageSearchResults(runId, { ...filters, favoritesOnly: true }),
      ]);

    // Jamais getExecutiveSummary (génération IA) ici : uniquement une lecture
    // du cache déjà rempli par le chargement du dashboard sur ce scope (voir
    // pdf-export, Requirement "PDF Includes Executive Summary Without
    // Triggering AI Generation").
    const classifiedCount = themeRiskScores.reduce((sum, entry) => sum + entry.messageCount, 0);
    const scopeKey = computeScopeKey(filters, classifiedCount);
    const summary = await getCachedExecutiveSummary(runId, scopeKey);

    const generatedAt = new Date();
    const buffer = await renderToBuffer(
      <ExportDocument
        generatedAt={generatedAt}
        summary={summary}
        score={score}
        evolution={evolution}
        platforms={platforms}
        countries={countries}
        favorites={favoritesResult.results}
        favoritesIsTruncated={favoritesResult.isTruncated}
      />,
    );

    // BodyInit n'inclut pas Buffer dans les types lib.dom utilisés ici :
    // Uint8Array est accepté et reste négligeable face au coût du rendu PDF.
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="insight-hub-rapport-${formatFilenameDate(generatedAt)}.pdf"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
