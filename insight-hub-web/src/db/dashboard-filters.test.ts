import { describe, expect, it } from "vitest";

import {
  favoritesCondition,
  parseDashboardFilters,
  previousPeriodFilters,
  searchCondition,
  type DashboardFilters,
} from "@/db/dashboard-filters";

function filters(overrides: Partial<DashboardFilters> = {}): DashboardFilters {
  return { ...overrides };
}

describe("searchCondition", () => {
  it("ignore le filtre quand aucun terme de recherche n'est fourni", () => {
    expect(searchCondition(filters())).toBeUndefined();
  });

  it("ignore le filtre quand le terme de recherche est vide ou composé uniquement d'espaces", () => {
    expect(searchCondition(filters({ query: "" }))).toBeUndefined();
    expect(searchCondition(filters({ query: "   " }))).toBeUndefined();
  });

  it("produit une condition quand un terme de recherche est fourni", () => {
    expect(searchCondition(filters({ query: "incident" }))).toBeDefined();
  });
});

describe("favoritesCondition", () => {
  it("ignore le filtre quand favoritesOnly est absent ou faux", () => {
    expect(favoritesCondition(filters())).toBeUndefined();
    expect(favoritesCondition(filters({ favoritesOnly: false }))).toBeUndefined();
  });

  it("produit une condition quand favoritesOnly est vrai", () => {
    expect(favoritesCondition(filters({ favoritesOnly: true }))).toBeDefined();
  });
});

describe("parseDashboardFilters", () => {
  it("parse tous les champs valides depuis des searchParams simples", () => {
    expect(
      parseDashboardFilters({
        dateFrom: "2026-07-01",
        dateTo: "2026-07-07",
        platform: "Twitter",
        country: "France",
        sentiment: "positif",
        themeId: "3",
        q: "livraison",
        favorisUniquement: "1",
      }),
    ).toEqual({
      dateFrom: "2026-07-01",
      dateTo: "2026-07-07",
      platform: "Twitter",
      country: "France",
      sentiment: "positif",
      themeId: 3,
      query: "livraison",
      favoritesOnly: true,
    });
  });

  it("prend la première valeur quand un searchParam est un tableau", () => {
    expect(
      parseDashboardFilters({ platform: ["Twitter", "Facebook"], dateFrom: ["2026-07-01"] }),
    ).toEqual(
      expect.objectContaining({ platform: "Twitter", dateFrom: "2026-07-01" }),
    );
  });

  it("ignore les valeurs invalides plutôt que de planter", () => {
    expect(
      parseDashboardFilters({
        dateFrom: "07/01/2026",
        dateTo: "not-a-date",
        sentiment: "furieux",
        themeId: "not-a-number",
      }),
    ).toEqual({
      dateFrom: undefined,
      dateTo: undefined,
      platform: undefined,
      country: undefined,
      sentiment: undefined,
      themeId: undefined,
      query: undefined,
      favoritesOnly: false,
    });
  });

  it("retourne des filtres vides quand aucun searchParam n'est fourni", () => {
    expect(parseDashboardFilters({})).toEqual({
      dateFrom: undefined,
      dateTo: undefined,
      platform: undefined,
      country: undefined,
      sentiment: undefined,
      themeId: undefined,
      query: undefined,
      favoritesOnly: false,
    });
  });

  it("considère favorisUniquement comme faux pour toute valeur autre que \"1\"", () => {
    expect(parseDashboardFilters({ favorisUniquement: "true" }).favoritesOnly).toBe(false);
    expect(parseDashboardFilters({ favorisUniquement: "0" }).favoritesOnly).toBe(false);
  });
});

describe("previousPeriodFilters", () => {
  it("retourne null quand dateFrom et dateTo sont absents", () => {
    expect(previousPeriodFilters(filters())).toBeNull();
  });

  it("retourne null quand une seule des deux bornes est présente", () => {
    expect(previousPeriodFilters(filters({ dateFrom: "2026-07-01" }))).toBeNull();
    expect(previousPeriodFilters(filters({ dateTo: "2026-07-07" }))).toBeNull();
  });

  it("retourne null quand une borne est invalide", () => {
    expect(
      previousPeriodFilters(filters({ dateFrom: "07/01/2026", dateTo: "2026-07-07" })),
    ).toBeNull();
    expect(
      previousPeriodFilters(filters({ dateFrom: "2026-07-01", dateTo: "not-a-date" })),
    ).toBeNull();
  });

  it("retourne null quand dateTo précède dateFrom", () => {
    expect(
      previousPeriodFilters(filters({ dateFrom: "2026-07-07", dateTo: "2026-07-01" })),
    ).toBeNull();
  });

  it("calcule une période précédente d'un jour à partir d'une période d'un jour", () => {
    expect(previousPeriodFilters(filters({ dateFrom: "2026-07-01", dateTo: "2026-07-01" }))).toEqual(
      { dateFrom: "2026-06-30", dateTo: "2026-06-30" },
    );
  });

  it("calcule une période précédente de 7 jours à partir d'une période de 7 jours", () => {
    expect(previousPeriodFilters(filters({ dateFrom: "2026-07-01", dateTo: "2026-07-07" }))).toEqual(
      { dateFrom: "2026-06-24", dateTo: "2026-06-30" },
    );
  });

  it("conserve les autres dimensions de filtre inchangées", () => {
    expect(
      previousPeriodFilters(
        filters({
          dateFrom: "2026-07-01",
          dateTo: "2026-07-07",
          platform: "Twitter",
          country: "France",
          sentiment: "positif",
          themeId: 3,
        }),
      ),
    ).toEqual({
      dateFrom: "2026-06-24",
      dateTo: "2026-06-30",
      platform: "Twitter",
      country: "France",
      sentiment: "positif",
      themeId: 3,
    });
  });
});
