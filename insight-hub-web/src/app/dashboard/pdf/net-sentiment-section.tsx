import { Circle, Line, Path, Svg, Text, View } from "@react-pdf/renderer";

import type { DailyNetSentiment } from "@/db/net-sentiment-score";

import { buildEvolutionPathPoints } from "../chart-geometry";
import { COLORS, styles } from "./styles";

// Mêmes proportions que CHART_WIDTH/CHART_HEIGHT/CHART_PADDING dans
// net-sentiment-card.tsx (le viewBox absorbe la différence d'échelle,
// voir buildEvolutionPathPoints) — largeur réduite pour tenir dans la
// marge de la page PDF (voir styles.page).
const CHART_WIDTH = 480;
const CHART_HEIGHT = 140;
const CHART_PADDING = 20;

function formatScore(value: number): string {
  const rounded = Math.round(value);
  return rounded > 0 ? `+${rounded}` : `${rounded}`;
}

// Le score net et son évolution proviennent tous deux du même volume de
// messages classés (voir net-sentiment-score.ts) : score === null signifie
// donc qu'aucun message n'est classé sur ce scope, condition unique pour
// basculer sur la mention d'absence de données (voir pdf-export,
// Requirement "PDF Includes Net Sentiment Score And Evolution Chart").
export function NetSentimentSection({
  score,
  evolution,
}: {
  score: number | null;
  evolution: DailyNetSentiment[];
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.kicker}>Sentiment</Text>
      <Text style={styles.heading}>Score de sentiment net</Text>
      {score === null ? (
        <Text style={styles.emptyState}>Aucun message classé pour ce scope.</Text>
      ) : (
        <>
          <Text
            style={[
              styles.kpiValue,
              ...(score > 0 ? [styles.kpiValuePositive] : []),
              ...(score < 0 ? [styles.kpiValueNegative] : []),
            ]}
          >
            {formatScore(score)} pts
          </Text>
          {evolution.length > 0 && <EvolutionChart evolution={evolution} />}
        </>
      )}
    </View>
  );
}

function EvolutionChart({ evolution }: { evolution: DailyNetSentiment[] }) {
  const { points, path, zeroY } = buildEvolutionPathPoints(
    evolution,
    CHART_WIDTH,
    CHART_HEIGHT,
    CHART_PADDING,
  );
  const first = evolution[0];
  const last = evolution[evolution.length - 1];

  return (
    <View>
      <Svg width={CHART_WIDTH} height={CHART_HEIGHT} viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}>
        <Line
          x1={CHART_PADDING}
          y1={zeroY}
          x2={CHART_WIDTH - CHART_PADDING}
          y2={zeroY}
          stroke={COLORS.border}
          strokeDasharray="4 4"
        />
        <Path d={path} stroke={COLORS.primary} strokeWidth={2} fill="none" />
        {points.map((point) => (
          <Circle key={point.date} cx={point.x} cy={point.y} r={2} fill={COLORS.primary} />
        ))}
      </Svg>
      <View style={styles.chartAxisRow}>
        <Text style={styles.chartAxisLabel}>{first.date}</Text>
        <Text style={styles.chartAxisLabel}>{last.date}</Text>
      </View>
    </View>
  );
}
