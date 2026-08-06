import { describe, expect, it } from "vitest";

import {
  buildCountryDistribution,
  UNKNOWN_COUNTRY_LABEL,
  type CountrySentimentRow,
} from "@/db/message-distribution";

function row(overrides: Partial<CountrySentimentRow> = {}): CountrySentimentRow {
  return { country: "France", sentiment: null, sentimentOriginal: null, ...overrides };
}

describe("buildCountryDistribution", () => {
  it("calcule un score net pour un pays ayant des messages classés", () => {
    const rows = [
      row({ country: "France", sentiment: "positif" }),
      row({ country: "France", sentiment: "positif" }),
      row({ country: "France", sentiment: "négatif" }),
      row({ country: "France", sentiment: "neutre" }),
    ];

    const [entry] = buildCountryDistribution(rows, "ai");

    expect(entry.label).toBe("France");
    expect(entry.messageCount).toBe(4);
    // (2 positifs - 1 négatif) / 4 classés * 100 = 25
    expect(entry.netScore).toBe(25);
  });

  it("retourne un score net null pour un pays sans message classé, plutôt qu'un score à zéro", () => {
    const rows = [
      row({ country: "Allemagne", sentiment: null }),
      row({ country: "Allemagne", sentiment: null }),
    ];

    const [entry] = buildCountryDistribution(rows, "ai");

    expect(entry.messageCount).toBe(2);
    expect(entry.netScore).toBeNull();
  });

  it("ignore les messages non classés dans le calcul du score net d'un pays par ailleurs classé", () => {
    const rows = [
      row({ country: "France", sentiment: "positif" }),
      row({ country: "France", sentiment: null }),
      row({ country: "France", sentiment: null }),
    ];

    const [entry] = buildCountryDistribution(rows, "ai");

    expect(entry.messageCount).toBe(3);
    // 1 positif / 1 classé * 100 = 100, les 2 messages non classés ne comptent
    // pas dans le score mais restent dans le volume.
    expect(entry.netScore).toBe(100);
  });

  it("calcule un score net indépendant par pays", () => {
    const rows = [
      row({ country: "France", sentiment: "positif" }),
      row({ country: "France", sentiment: "positif" }),
      row({ country: "Allemagne", sentiment: "négatif" }),
    ];

    const entries = buildCountryDistribution(rows, "ai");
    const france = entries.find((entry) => entry.label === "France");
    const allemagne = entries.find((entry) => entry.label === "Allemagne");

    expect(france?.netScore).toBe(100);
    expect(allemagne?.netScore).toBe(-100);
  });

  it("regroupe les pays absents ou vides sous le libellé Non renseigné", () => {
    const rows = [row({ country: null }), row({ country: "  " }), row({ country: "France" })];

    const entries = buildCountryDistribution(rows, "ai");
    const unknown = entries.find((entry) => entry.label === UNKNOWN_COUNTRY_LABEL);

    expect(unknown?.messageCount).toBe(2);
  });

  it("trie par volume décroissant et calcule la part de chaque pays", () => {
    const rows = [
      row({ country: "France" }),
      row({ country: "Allemagne" }),
      row({ country: "Allemagne" }),
      row({ country: "Allemagne" }),
    ];

    const entries = buildCountryDistribution(rows, "ai");

    expect(entries.map((entry) => entry.label)).toEqual(["Allemagne", "France"]);
    expect(entries[0].share).toBeCloseTo(0.75);
    expect(entries[1].share).toBeCloseTo(0.25);
  });

  it("utilise le mapping csv_original quand la source de sentiment est provisoire", () => {
    const rows = [
      row({ country: "France", sentiment: null, sentimentOriginal: "joy" }),
      row({ country: "France", sentiment: null, sentimentOriginal: "anger" }),
    ];

    const [entry] = buildCountryDistribution(rows, "csv_original");

    expect(entry.netScore).toBe(0);
  });

  it("retourne un tableau vide pour une liste de messages vide", () => {
    expect(buildCountryDistribution([], "ai")).toEqual([]);
  });
});
