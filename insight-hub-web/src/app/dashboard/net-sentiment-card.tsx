import type { DailyNetSentiment } from "@/db/net-sentiment-score";

const CHART_WIDTH = 560;
const CHART_HEIGHT = 160;
const CHART_PADDING = 20;

export function NetSentimentCard({
  score,
  evolution,
  source,
}: {
  score: number | null;
  evolution: DailyNetSentiment[];
  source: "ai" | "csv_original";
}) {
  return (
    <div className="card">
      <span className="kicker">Sentiment</span>
      <h2>Score de sentiment net</h2>
      <p className="subtitle">
        (messages positifs − messages négatifs) / total des messages classés.
      </p>
      {source === "csv_original" && (
        <p className="provisional-notice">
          Score provisoire, basé sur le sentiment original du CSV (émotion brute), pas sur une
          classification IA — la classification IA n&apos;est pas encore activée.
        </p>
      )}
      <NetScoreValue score={score} />
      {evolution.length > 0 ? (
        <EvolutionChart evolution={evolution} />
      ) : (
        <p className="empty-state">Aucun message classé pour l&apos;instant.</p>
      )}
    </div>
  );
}

function NetScoreValue({ score }: { score: number | null }) {
  if (score === null) {
    return <p className="empty-state">Score indisponible : aucun message classé pour l&apos;instant.</p>;
  }

  const variant = score > 0 ? "positive" : score < 0 ? "negative" : "";
  const formatted = score > 0 ? `+${score}` : `${score}`;

  return (
    <div className={`kpi-value ${variant ? `kpi-value--${variant}` : ""}`}>
      {formatted}
      <span className="kpi-unit">pts</span>
    </div>
  );
}

function EvolutionChart({ evolution }: { evolution: DailyNetSentiment[] }) {
  const innerWidth = CHART_WIDTH - CHART_PADDING * 2;
  const innerHeight = CHART_HEIGHT - CHART_PADDING * 2;
  const zeroY = CHART_PADDING + innerHeight / 2;

  const points = evolution.map((point, index) => {
    const x =
      evolution.length === 1
        ? CHART_PADDING + innerWidth / 2
        : CHART_PADDING + (index / (evolution.length - 1)) * innerWidth;
    const y = CHART_PADDING + innerHeight / 2 - (point.netScore / 100) * (innerHeight / 2);
    return { x, y, point };
  });

  const path = points.map((p, index) => `${index === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const first = evolution[0];
  const last = evolution[evolution.length - 1];

  return (
    <svg
      className="evolution-chart"
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      role="img"
      aria-label={`Évolution du score net du ${first.date} au ${last.date}`}
    >
      <line
        x1={CHART_PADDING}
        y1={zeroY}
        x2={CHART_WIDTH - CHART_PADDING}
        y2={zeroY}
        stroke="var(--color-border)"
        strokeDasharray="4 4"
      />
      <path d={path} fill="none" stroke="var(--color-primary)" strokeWidth={2} />
      {points.map(({ x, y, point }) => (
        <circle key={point.date} cx={x} cy={y} r={2.5} fill="var(--color-primary)" />
      ))}
      <text x={CHART_PADDING} y={CHART_HEIGHT - 4}>
        {first.date}
      </text>
      <text x={CHART_WIDTH - CHART_PADDING} y={CHART_HEIGHT - 4} textAnchor="end">
        {last.date}
      </text>
    </svg>
  );
}
