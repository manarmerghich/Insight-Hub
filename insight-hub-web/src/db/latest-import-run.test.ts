import { describe, expect, it } from "vitest";

import { distinctKeywordCandidates } from "@/db/latest-import-run";

describe("distinctKeywordCandidates", () => {
  it("ne garde que la recherche la plus récente de chaque mot-clé", () => {
    const runs = [
      { id: 12, keyword: "Nike", sourceFilename: "nike-2.csv", startedAt: new Date("2026-08-30") },
      { id: 9, keyword: "Adidas", sourceFilename: "adidas.csv", startedAt: new Date("2026-08-20") },
      { id: 3, keyword: "Nike", sourceFilename: "nike-1.csv", startedAt: new Date("2026-08-01") },
    ];

    expect(distinctKeywordCandidates(runs)).toEqual([
      { id: 12, keyword: "Nike", sourceFilename: "nike-2.csv", startedAt: new Date("2026-08-30") },
      { id: 9, keyword: "Adidas", sourceFilename: "adidas.csv", startedAt: new Date("2026-08-20") },
    ]);
  });

  it("déduplique un même mot-clé recherché avec une casse différente", () => {
    const runs = [
      { id: 5, keyword: "NIKE", sourceFilename: "nike-b.csv", startedAt: new Date("2026-08-10") },
      { id: 4, keyword: "nike", sourceFilename: "nike-a.csv", startedAt: new Date("2026-08-05") },
    ];

    expect(distinctKeywordCandidates(runs)).toEqual([
      { id: 5, keyword: "NIKE", sourceFilename: "nike-b.csv", startedAt: new Date("2026-08-10") },
    ]);
  });

  it("retourne une liste vide quand aucun run n'existe", () => {
    expect(distinctKeywordCandidates([])).toEqual([]);
  });

  it("préserve l'ordre d'entrée (déjà trié par id desc en amont)", () => {
    const runs = [
      { id: 7, keyword: "Zara", sourceFilename: "zara.csv", startedAt: new Date("2026-08-25") },
      { id: 6, keyword: "Nike", sourceFilename: "nike.csv", startedAt: new Date("2026-08-24") },
      { id: 2, keyword: "Adidas", sourceFilename: "adidas.csv", startedAt: new Date("2026-08-10") },
    ];

    expect(distinctKeywordCandidates(runs).map((r) => r.keyword)).toEqual(["Zara", "Nike", "Adidas"]);
  });
});
