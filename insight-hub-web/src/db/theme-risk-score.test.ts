import { describe, expect, it } from "vitest";

import {
  buildThemeRiskScores,
  computeThemeRiskScore,
  mergeThemeRiskScoreTrend,
  type ThemeRiskScoreEntry,
  type ThemeRiskScoreMessageRow,
  type ThemeRow,
} from "@/db/theme-risk-score";

function themeRow(overrides: Partial<ThemeRow> = {}): ThemeRow {
  return { id: 1, label: "Thème A", ...overrides };
}

function messageRow(overrides: Partial<ThemeRiskScoreMessageRow> = {}): ThemeRiskScoreMessageRow {
  return { themeId: 1, themeStatus: "completed", sentiment: null, sentimentStatus: "completed", ...overrides };
}

function entry(overrides: Partial<ThemeRiskScoreEntry> = {}): ThemeRiskScoreEntry {
  return { themeId: 1, label: "Thème A", messageCount: 0, negativeCount: 0, score: 0, trend: null, ...overrides };
}

describe("computeThemeRiskScore", () => {
  it("calcule le score comme (part de volume) × (part de négatif) × 100", () => {
    // Thème avec 40 messages classés sur 100 au total, 10 négatifs parmi eux :
    // (40/100) × (10/40) × 100 = 10.
    expect(computeThemeRiskScore(40, 10, 100)).toBe(10);
  });

  it("retourne 0 pour un thème sans message classé dans ce scope, plutôt qu'une division par zéro", () => {
    expect(computeThemeRiskScore(0, 0, 100)).toBe(0);
  });

  it("retourne 0 quand aucun message n'est classé pour aucun thème (total = 0)", () => {
    expect(computeThemeRiskScore(0, 0, 0)).toBe(0);
  });

  it("retourne 100 quand un thème concentre tout le volume et est entièrement négatif", () => {
    expect(computeThemeRiskScore(50, 50, 50)).toBe(100);
  });

  it("arrondit le résultat comme computeNetScore", () => {
    // (30/90) × (7/30) × 100 = 7.777... -> 8
    expect(computeThemeRiskScore(30, 7, 90)).toBe(8);
  });
});

describe("buildThemeRiskScores", () => {
  it("calcule le score de chaque thème à partir des messages classés sur les deux axes", () => {
    const themes = [themeRow({ id: 1, label: "Support" }), themeRow({ id: 2, label: "Livraison" })];
    const rows = [
      messageRow({ themeId: 1, sentiment: "négatif" }),
      messageRow({ themeId: 1, sentiment: "positif" }),
      messageRow({ themeId: 2, sentiment: "négatif" }),
      messageRow({ themeId: 2, sentiment: "négatif" }),
    ];

    const entries = buildThemeRiskScores(themes, rows);
    const support = entries.find((e) => e.themeId === 1);
    const livraison = entries.find((e) => e.themeId === 2);

    // total classé = 4. Support : (2/4) × (1/2) × 100 = 25.
    expect(support?.score).toBe(25);
    // Livraison : (2/4) × (2/2) × 100 = 50.
    expect(livraison?.score).toBe(50);
  });

  it("attribue un score de 0 à un thème du référentiel sans message dans ce scope, sans l'omettre", () => {
    const themes = [themeRow({ id: 1, label: "Support" }), themeRow({ id: 2, label: "Livraison" })];
    const rows = [messageRow({ themeId: 1, sentiment: "négatif" })];

    const entries = buildThemeRiskScores(themes, rows);

    expect(entries).toHaveLength(2);
    const livraison = entries.find((e) => e.themeId === 2);
    expect(livraison?.score).toBe(0);
    expect(livraison?.messageCount).toBe(0);
  });

  it("exclut un message classé sur un seul des deux axes (thème classé, sentiment non classé)", () => {
    const themes = [themeRow({ id: 1 })];
    const rows = [
      messageRow({ themeId: 1, sentiment: "négatif" }),
      messageRow({ themeId: 1, sentiment: null, sentimentStatus: "pending" }),
    ];

    const entries = buildThemeRiskScores(themes, rows);

    expect(entries[0].messageCount).toBe(1);
  });

  it("exclut un message classé sur un seul des deux axes (sentiment classé, thème non classé)", () => {
    const themes = [themeRow({ id: 1 })];
    const rows = [
      messageRow({ themeId: 1, sentiment: "négatif" }),
      messageRow({ themeId: 1, sentiment: "négatif", themeStatus: "error" }),
    ];

    const entries = buildThemeRiskScores(themes, rows);

    expect(entries[0].messageCount).toBe(1);
  });

  it("retourne une liste vide quand le référentiel des thèmes est vide", () => {
    expect(buildThemeRiskScores([], [messageRow()])).toEqual([]);
  });

  it("retourne tous les thèmes à 0 quand aucun message n'est classé sur les deux axes", () => {
    const themes = [themeRow({ id: 1 }), themeRow({ id: 2, label: "Livraison" })];
    const rows = [messageRow({ themeId: 1, sentimentStatus: "pending", sentiment: null })];

    const entries = buildThemeRiskScores(themes, rows);

    expect(entries.every((e) => e.score === 0)).toBe(true);
  });

  it("trie les thèmes par score décroissant", () => {
    const themes = [themeRow({ id: 1, label: "Faible" }), themeRow({ id: 2, label: "Fort" })];
    const rows = [
      messageRow({ themeId: 1, sentiment: "positif" }),
      messageRow({ themeId: 2, sentiment: "négatif" }),
      messageRow({ themeId: 2, sentiment: "négatif" }),
    ];

    const entries = buildThemeRiskScores(themes, rows);

    expect(entries.map((e) => e.label)).toEqual(["Fort", "Faible"]);
  });
});

describe("mergeThemeRiskScoreTrend", () => {
  it("retourne un delta positif quand le score courant est supérieur au score précédent", () => {
    const current = [entry({ themeId: 1, score: 30 })];
    const previous = [entry({ themeId: 1, score: 10 })];

    expect(mergeThemeRiskScoreTrend(current, previous)[0].trend).toBe(20);
  });

  it("retourne un delta négatif quand le score courant est inférieur au score précédent", () => {
    const current = [entry({ themeId: 1, score: 10 })];
    const previous = [entry({ themeId: 1, score: 30 })];

    expect(mergeThemeRiskScoreTrend(current, previous)[0].trend).toBe(-20);
  });

  it("retourne un delta nul quand le score courant est égal au score précédent", () => {
    const current = [entry({ themeId: 1, score: 15 })];
    const previous = [entry({ themeId: 1, score: 15 })];

    expect(mergeThemeRiskScoreTrend(current, previous)[0].trend).toBe(0);
  });

  it("retourne trend: null pour tous les thèmes quand la période précédente n'est pas calculable", () => {
    const current = [entry({ themeId: 1, score: 15 }), entry({ themeId: 2, score: 5 })];

    const merged = mergeThemeRiskScoreTrend(current, null);

    expect(merged.every((e) => e.trend === null)).toBe(true);
  });

  it("affiche le delta même quand le score précédent est 0 (thème absent de la période précédente)", () => {
    const current = [entry({ themeId: 1, score: 12 })];
    const previous = [entry({ themeId: 1, score: 0, messageCount: 0 })];

    expect(mergeThemeRiskScoreTrend(current, previous)[0].trend).toBe(12);
  });
});
