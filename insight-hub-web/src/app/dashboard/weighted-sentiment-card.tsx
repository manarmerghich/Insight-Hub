export function WeightedSentimentCard({ score }: { score: number | null }) {
  return (
    <div className="card">
      <span className="kicker">Sentiment</span>
      <h2>Score de sentiment pondéré par engagement</h2>
      <p className="subtitle">
        Comme le score net, mais chaque message pèse selon son engagement (1 + likes + retweets)
        plutôt que de compter à égalité avec les autres.
      </p>
      <WeightedScoreValue score={score} />
    </div>
  );
}

function WeightedScoreValue({ score }: { score: number | null }) {
  if (score === null) {
    return (
      <p className="empty-state">Score indisponible : aucun message classé pour l&apos;instant.</p>
    );
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
