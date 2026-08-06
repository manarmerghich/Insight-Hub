// Géométrie du graphique d'évolution du score de sentiment net, extraite de
// net-sentiment-card.tsx (EvolutionChart) pour être partagée avec le rendu
// PDF (voir pdf-export, design.md, Decision "Graphique d'évolution en
// Svg/Path avec la même géométrie que EvolutionChart") — fonction pure, pas
// de dépendance à React ni au DOM, réutilisable telle quelle côté serveur.

export type EvolutionPathInput = {
  date: string;
  netScore: number;
};

export type EvolutionPathPoint = {
  x: number;
  y: number;
  date: string;
  netScore: number;
};

export type EvolutionPathGeometry = {
  points: EvolutionPathPoint[];
  // Chemin SVG ("M x y L x y ...") prêt à être utilisé tel quel dans un
  // <path d={...}> (DOM) ou un <Path d={...}> (@react-pdf/renderer) — chaîne
  // vide pour une série vide.
  path: string;
  // Position Y de la ligne de référence à zéro, utile pour dessiner l'axe
  // même quand `points` est vide.
  zeroY: number;
};

export function buildEvolutionPathPoints(
  evolution: EvolutionPathInput[],
  width: number,
  height: number,
  padding: number,
): EvolutionPathGeometry {
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;
  const zeroY = padding + innerHeight / 2;

  const points = evolution.map((point, index) => {
    const x =
      evolution.length === 1
        ? padding + innerWidth / 2
        : padding + (index / (evolution.length - 1)) * innerWidth;
    const y = padding + innerHeight / 2 - (point.netScore / 100) * (innerHeight / 2);
    return { x, y, date: point.date, netScore: point.netScore };
  });

  const path = points.map((p, index) => `${index === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  return { points, path, zeroY };
}
