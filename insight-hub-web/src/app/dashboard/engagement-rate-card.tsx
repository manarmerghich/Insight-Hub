import type { EngagementRateEntry } from "@/db/engagement-rate";

const SENTIMENT_LABELS: Record<EngagementRateEntry["sentiment"], string> = {
  positif: "Positif",
  négatif: "Négatif",
  neutre: "Neutre",
};

function formatAverage(value: number): string {
  return value.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
}

export function EngagementRateCard({ entries }: { entries: EngagementRateEntry[] }) {
  return (
    <div className="card">
      <span className="kicker">Engagement</span>
      <h2>Taux d&apos;engagement par sentiment</h2>
      <p className="subtitle">
        Moyenne des likes et des retweets par message, pour chaque catégorie de sentiment classée.
      </p>
      {entries.length > 0 ? (
        <div className="engagement-rate-list">
          {entries.map((entry) => (
            <div className="engagement-rate-row" key={entry.sentiment}>
              <span className="engagement-rate-row__label">{SENTIMENT_LABELS[entry.sentiment]}</span>
              <div className="engagement-rate-row__metrics">
                <span className="kpi-value">
                  {formatAverage(entry.avgLikes)}
                  <span className="kpi-unit">likes / message</span>
                </span>
                <span className="kpi-value">
                  {formatAverage(entry.avgRetweets)}
                  <span className="kpi-unit">retweets / message</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="empty-state">Aucun message classé pour l&apos;instant.</p>
      )}
    </div>
  );
}
