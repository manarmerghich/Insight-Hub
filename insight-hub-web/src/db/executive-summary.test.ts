import { describe, expect, it } from "vitest";

import {
  computeScopeKey,
  getExecutiveSummary,
  type ExecutiveSummaryKpis,
} from "@/db/executive-summary";
import type { DashboardFilters } from "@/db/dashboard-filters";

function kpis(overrides: Partial<ExecutiveSummaryKpis> = {}): ExecutiveSummaryKpis {
  return {
    netSentimentScore: 42,
    netSentimentTrend: null,
    topRiskTheme: null,
    platformDistribution: [],
    countryDistribution: [],
    representativeMessage: null,
    classifiedCount: 10,
    ...overrides,
  };
}

describe("computeScopeKey", () => {
  it("est stable pour des filtres équivalents", () => {
    const filters: DashboardFilters = { platform: "Twitter", country: "France" };

    expect(computeScopeKey(filters, 10)).toBe(computeScopeKey({ ...filters }, 10));
  });

  it("change quand un filtre change", () => {
    const a = computeScopeKey({ platform: "Twitter" }, 10);
    const b = computeScopeKey({ platform: "Instagram" }, 10);

    expect(a).not.toBe(b);
  });

  it("change quand le volume de messages classés change", () => {
    const a = computeScopeKey({ platform: "Twitter" }, 10);
    const b = computeScopeKey({ platform: "Twitter" }, 11);

    expect(a).not.toBe(b);
  });
});

describe("getExecutiveSummary", () => {
  it("retourne le résumé en cache sans appeler le pipeline", async () => {
    let pipelineCallCount = 0;
    const getCached = async () => "résumé déjà en cache";
    const callPipeline = async () => {
      pipelineCallCount++;
      return "ne devrait jamais être retourné";
    };

    const result = await getExecutiveSummary(1, {}, kpis(), { getCached, callPipeline });

    expect(result).toBe("résumé déjà en cache");
    expect(pipelineCallCount).toBe(0);
  });

  it("appelle le pipeline et retourne son texte quand le cache est absent", async () => {
    const getCached = async () => null;
    const callPipeline = async () => "nouveau résumé généré";

    const result = await getExecutiveSummary(1, {}, kpis(), { getCached, callPipeline });

    expect(result).toBe("nouveau résumé généré");
  });

  it("retourne null sans lever d'exception quand l'appel pipeline échoue ou dépasse son délai", async () => {
    const getCached = async () => null;
    // callPipelineSummary absorbe déjà elle-même les échecs réseau/timeout
    // et retourne null (voir son propre try/catch) : ce test vérifie que
    // getExecutiveSummary propage bien ce null sans jamais lever.
    const callPipeline = async () => null;

    const result = await getExecutiveSummary(1, {}, kpis(), { getCached, callPipeline });

    expect(result).toBeNull();
  });

  it("retourne null sans lever d'exception si le cache lui-même échoue", async () => {
    const getCached = async () => {
      throw new Error("connexion DB indisponible");
    };
    const callPipeline = async () => null;

    const result = await getExecutiveSummary(1, {}, kpis(), { getCached, callPipeline });

    expect(result).toBeNull();
  });
});
