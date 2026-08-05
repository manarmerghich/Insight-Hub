import { describe, expect, it } from "vitest";

import { detectNetSentimentPeaks } from "@/db/sentiment-timeline-peaks";
import type { DailyNetSentiment } from "@/db/net-sentiment-score";

function day(date: string, netScore: number): DailyNetSentiment {
  return { date, netScore, positive: 0, negative: 0, neutral: 0, total: 0 };
}

describe("detectNetSentimentPeaks", () => {
  it("ne détecte aucun pic sur une série de moins de 5 jours, même très dispersée", () => {
    const evolution = [
      day("2026-01-01", 0),
      day("2026-01-02", 0),
      day("2026-01-03", 0),
      day("2026-01-04", 100),
    ];

    expect(detectNetSentimentPeaks(evolution)).toEqual([]);
  });

  it("ne détecte aucun pic quand tous les jours ont le même score net (écart-type nul)", () => {
    const evolution = [
      day("2026-01-01", 10),
      day("2026-01-02", 10),
      day("2026-01-03", 10),
      day("2026-01-04", 10),
      day("2026-01-05", 10),
    ];

    expect(detectNetSentimentPeaks(evolution)).toEqual([]);
  });

  it("marque un pic positif quand un jour dépasse la moyenne de plus de 2 écarts-types", () => {
    // Une base stable sur 9 jours limite l'inflation de l'écart-type par le
    // jour extrême lui-même (cf. design.md, risque connu de l'écart-type
    // population sur petite série).
    const baseline = Array.from({ length: 9 }, (_, i) => day(`2026-01-0${i + 1}`, 10));
    const evolution = [...baseline, day("2026-01-10", 100)];

    const peaks = detectNetSentimentPeaks(evolution);

    expect(peaks).toHaveLength(1);
    expect(peaks[0]).toMatchObject({ date: "2026-01-10", netScore: 100, direction: "positive" });
    expect(peaks[0].deviationFromMean).toBeGreaterThan(0);
  });

  it("marque un pic négatif quand un jour est inférieur à la moyenne de plus de 2 écarts-types", () => {
    const baseline = Array.from({ length: 9 }, (_, i) => day(`2026-01-0${i + 1}`, 10));
    const evolution = [...baseline, day("2026-01-10", -80)];

    const peaks = detectNetSentimentPeaks(evolution);

    expect(peaks).toHaveLength(1);
    expect(peaks[0]).toMatchObject({ date: "2026-01-10", netScore: -80, direction: "negative" });
    expect(peaks[0].deviationFromMean).toBeLessThan(0);
  });

  it("ne marque pas un jour dont l'écart à la moyenne reste dans la plage normale", () => {
    const evolution = [
      day("2026-01-01", 10),
      day("2026-01-02", 12),
      day("2026-01-03", 8),
      day("2026-01-04", 11),
      day("2026-01-05", 9),
    ];

    expect(detectNetSentimentPeaks(evolution)).toEqual([]);
  });
});
