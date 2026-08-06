import { describe, expect, it } from "vitest";

import { MAX_WORDS_PER_CATEGORY, rankWordFrequencies, tokenize } from "@/db/sentiment-word-cloud";

describe("tokenize", () => {
  it("met en minuscules et découpe sur les espaces", () => {
    expect(tokenize("Great Product")).toEqual(["great", "product"]);
  });

  it("découpe sur la ponctuation", () => {
    expect(tokenize("Amazing, truly amazing!")).toEqual(["amazing", "truly", "amazing"]);
  });

  it("découpe sur les emojis sans les inclure comme token", () => {
    // "this" et "so" sont filtrés (mot vide / trop court) : ne reste que
    // "loving" et "much".
    expect(tokenize("Loving this 😍 so much")).toEqual(["loving", "much"]);
  });

  it("conserve les caractères accentués (unicode-aware)", () => {
    expect(tokenize("Café énorme")).toEqual(["café", "énorme"]);
  });

  it("exclut les tokens de moins de MIN_WORD_LENGTH caractères", () => {
    expect(tokenize("it is so ok yes")).toEqual(["yes"]);
  });

  it("exclut les tokens entièrement numériques", () => {
    expect(tokenize("in 2024 we sold 1500 units")).toEqual(["sold", "units"]);
  });

  it("exclut les mots vides anglais courants", () => {
    expect(tokenize("this is the best product that we have")).toEqual(["best", "product"]);
  });

  it("exclut les fragments courts issus des contractions", () => {
    // "don't" -> "don" (exclu via STOP_WORDS) + "t" (exclu via MIN_WORD_LENGTH)
    expect(tokenize("don't like this")).toEqual(["like"]);
  });

  it("retourne un tableau vide pour un texte entièrement filtré", () => {
    expect(tokenize("it is 42 and the")).toEqual([]);
  });
});

describe("rankWordFrequencies", () => {
  it("compte les occurrences de chaque mot", () => {
    expect(rankWordFrequencies(["great", "great", "product"])).toEqual([
      { word: "great", count: 2 },
      { word: "product", count: 1 },
    ]);
  });

  it("trie par fréquence décroissante", () => {
    expect(rankWordFrequencies(["rare", "common", "common", "common"])).toEqual([
      { word: "common", count: 3 },
      { word: "rare", count: 1 },
    ]);
  });

  it("départage une égalité de fréquence par ordre alphabétique croissant", () => {
    expect(rankWordFrequencies(["zebra", "apple", "mango"])).toEqual([
      { word: "apple", count: 1 },
      { word: "mango", count: 1 },
      { word: "zebra", count: 1 },
    ]);
  });

  it("tronque au maximum de mots par catégorie", () => {
    const tokens = Array.from({ length: MAX_WORDS_PER_CATEGORY + 10 }, (_, index) => `word${index}`);
    const result = rankWordFrequencies(tokens);
    expect(result).toHaveLength(MAX_WORDS_PER_CATEGORY);
  });

  it("retourne un tableau vide pour une liste de tokens vide", () => {
    expect(rankWordFrequencies([])).toEqual([]);
  });
});
