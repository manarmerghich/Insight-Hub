import { describe, expect, it } from "vitest";

import { favoritesCondition, searchCondition, type DashboardFilters } from "@/db/dashboard-filters";

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
