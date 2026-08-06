import { describe, expect, it } from "vitest";

import {
  engagementScore,
  isMoreRepresentative,
  resolveSentimentLabel,
  type RepresentativeMessage,
} from "@/db/representative-messages";

function message(overrides: Partial<RepresentativeMessage> = {}): RepresentativeMessage {
  return {
    id: 1,
    text: "message",
    user: "user",
    platform: "twitter",
    timestamp: new Date("2026-01-01T00:00:00.000Z"),
    likes: null,
    retweets: null,
    isFavorite: false,
    ...overrides,
  };
}

describe("engagementScore", () => {
  it("traite les likes et retweets nuls comme 0", () => {
    expect(engagementScore(null, null)).toBe(0);
  });

  it("additionne likes et retweets renseignés", () => {
    expect(engagementScore(10, 5)).toBe(15);
  });

  it("additionne une valeur renseignée avec une valeur nulle", () => {
    expect(engagementScore(10, null)).toBe(10);
    expect(engagementScore(null, 5)).toBe(5);
  });
});

describe("isMoreRepresentative", () => {
  it("retient le candidat quand aucun message n'est encore retenu", () => {
    expect(isMoreRepresentative(message({ id: 1 }), null)).toBe(true);
  });

  it("retient le candidat ayant le plus d'engagement", () => {
    const current = message({ id: 1, likes: 5, retweets: 0 });
    const candidate = message({ id: 2, likes: 10, retweets: 0 });
    expect(isMoreRepresentative(candidate, current)).toBe(true);
  });

  it("ne remplace pas le message retenu par un candidat moins engageant", () => {
    const current = message({ id: 1, likes: 10, retweets: 0 });
    const candidate = message({ id: 2, likes: 5, retweets: 0 });
    expect(isMoreRepresentative(candidate, current)).toBe(false);
  });

  it("départage une égalité d'engagement par l'identifiant le plus petit", () => {
    const current = message({ id: 5, likes: 3, retweets: 2 });
    const smallerId = message({ id: 2, likes: 3, retweets: 2 });
    const largerId = message({ id: 9, likes: 3, retweets: 2 });

    expect(isMoreRepresentative(smallerId, current)).toBe(true);
    expect(isMoreRepresentative(largerId, current)).toBe(false);
  });

  it("traite les likes/retweets nuls comme 0 dans la comparaison", () => {
    const current = message({ id: 1, likes: null, retweets: null });
    const candidate = message({ id: 2, likes: 0, retweets: 1 });
    expect(isMoreRepresentative(candidate, current)).toBe(true);
  });
});

describe("resolveSentimentLabel", () => {
  it("en mode IA, utilise le sentiment classifié tel quel", () => {
    expect(
      resolveSentimentLabel("ai", { sentiment: "positif", sentimentOriginal: null }),
    ).toBe("positif");
  });

  it("en mode IA, retourne null si le sentiment n'est pas une catégorie reconnue", () => {
    expect(resolveSentimentLabel("ai", { sentiment: null, sentimentOriginal: null })).toBeNull();
    expect(
      resolveSentimentLabel("ai", { sentiment: "inconnu", sentimentOriginal: null }),
    ).toBeNull();
  });

  it("en mode provisoire, mappe l'émotion d'origine reconnue vers sa catégorie", () => {
    expect(
      resolveSentimentLabel("csv_original", { sentiment: null, sentimentOriginal: "joy" }),
    ).toBe("positif");
    expect(
      resolveSentimentLabel("csv_original", { sentiment: null, sentimentOriginal: "anger" }),
    ).toBe("négatif");
  });

  it("en mode provisoire, classe une émotion non reconnue comme neutre", () => {
    expect(
      resolveSentimentLabel("csv_original", { sentiment: null, sentimentOriginal: "ambivalence" }),
    ).toBe("neutre");
  });

  it("en mode provisoire, retourne null si aucune émotion d'origine n'est renseignée", () => {
    expect(
      resolveSentimentLabel("csv_original", { sentiment: null, sentimentOriginal: null }),
    ).toBeNull();
  });
});
