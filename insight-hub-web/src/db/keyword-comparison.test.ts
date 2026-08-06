import { describe, expect, it } from "vitest";

import { pickLatestRunId, sortComparableKeywords } from "@/db/keyword-comparison";

describe("sortComparableKeywords", () => {
  it("trie plusieurs mots-clés distincts par ordre alphabétique", () => {
    expect(sortComparableKeywords(["Zara", "Adidas", "Michelin"], null)).toEqual([
      "Adidas",
      "Michelin",
      "Zara",
    ]);
  });

  it("exclut le mot-clé courant, de manière insensible à la casse", () => {
    expect(sortComparableKeywords(["Nike", "Adidas"], "nike")).toEqual(["Adidas"]);
  });

  it("déduplique les mots-clés importés plusieurs fois, insensible à la casse", () => {
    expect(sortComparableKeywords(["Nike", "nike", "NIKE"], null)).toEqual(["Nike"]);
  });

  it("retourne une liste vide quand aucun mot-clé comparable n'est disponible", () => {
    expect(sortComparableKeywords(["Nike"], "nike")).toEqual([]);
    expect(sortComparableKeywords([], null)).toEqual([]);
  });
});

describe("pickLatestRunId", () => {
  it("retient le run le plus récent (id le plus grand) quand un mot-clé a été importé plusieurs fois", () => {
    expect(pickLatestRunId([3, 12, 7])).toBe(12);
  });

  it("retourne null quand le mot-clé n'a aucun run avec message", () => {
    expect(pickLatestRunId([])).toBeNull();
  });

  it("retourne l'unique id quand un seul run correspond", () => {
    expect(pickLatestRunId([5])).toBe(5);
  });
});
