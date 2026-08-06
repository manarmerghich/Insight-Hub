import { describe, expect, it } from "vitest";

import { buildEvolutionPathPoints } from "./chart-geometry";

const WIDTH = 560;
const HEIGHT = 160;
const PADDING = 20;

describe("buildEvolutionPathPoints", () => {
  it("retourne un chemin vide et aucun point pour une série vide", () => {
    const geometry = buildEvolutionPathPoints([], WIDTH, HEIGHT, PADDING);

    expect(geometry.points).toEqual([]);
    expect(geometry.path).toBe("");
    // La ligne de référence à zéro reste calculable même sans point.
    expect(geometry.zeroY).toBe(PADDING + (HEIGHT - PADDING * 2) / 2);
  });

  it("place un unique point au centre horizontal du graphique", () => {
    const geometry = buildEvolutionPathPoints(
      [{ date: "2026-07-01", netScore: 0 }],
      WIDTH,
      HEIGHT,
      PADDING,
    );

    expect(geometry.points).toHaveLength(1);
    const [point] = geometry.points;
    expect(point.x).toBe(PADDING + (WIDTH - PADDING * 2) / 2);
    expect(point.y).toBe(geometry.zeroY);
    expect(geometry.path).toBe(`M ${point.x} ${point.y}`);
  });

  it("répartit les points d'une série multi-points sur toute la largeur et place le score net sur l'axe vertical", () => {
    const geometry = buildEvolutionPathPoints(
      [
        { date: "2026-07-01", netScore: 100 },
        { date: "2026-07-02", netScore: 0 },
        { date: "2026-07-03", netScore: -100 },
      ],
      WIDTH,
      HEIGHT,
      PADDING,
    );

    const innerWidth = WIDTH - PADDING * 2;
    const innerHeight = HEIGHT - PADDING * 2;

    expect(geometry.points.map((point) => point.x)).toEqual([
      PADDING,
      PADDING + innerWidth / 2,
      PADDING + innerWidth,
    ]);
    // Score +100 tout en haut du graphique, -100 tout en bas, 0 sur la ligne
    // de référence à zéro.
    expect(geometry.points[0].y).toBe(PADDING);
    expect(geometry.points[1].y).toBe(geometry.zeroY);
    expect(geometry.points[2].y).toBe(PADDING + innerHeight);

    expect(geometry.path).toBe(
      `M ${geometry.points[0].x} ${geometry.points[0].y} L ${geometry.points[1].x} ${geometry.points[1].y} L ${geometry.points[2].x} ${geometry.points[2].y}`,
    );
  });
});
