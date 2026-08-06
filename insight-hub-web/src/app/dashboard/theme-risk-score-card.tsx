import type { ThemeRiskScoreEntry } from "@/db/theme-risk-score";

export function ThemeRiskScoreCard({ entries }: { entries: ThemeRiskScoreEntry[] }) {
  // La tendance n'est jamais partiellement disponible : soit une période
  // complète est active et getThemeRiskScoreTrend l'a calculée pour tous les
  // thèmes, soit aucune ne l'est et trend est null partout (voir
  // theme-risk-score.ts). Un seul thème suffit donc à décider si la colonne
  // de tendance doit être affichée.
  const hasTrend = entries.some((entry) => entry.trend !== null);

  return (
    <div className="card">
      <span className="kicker">Thèmes</span>
      <h2>Score de risque réputationnel</h2>
      <p className="subtitle">
        (part du volume classé du thème) × (part de messages négatifs du thème) × 100 — un thème
        volumineux légèrement négatif peut ainsi peser autant qu&apos;un petit thème très négatif.
      </p>
      {entries.length > 0 ? (
        <>
          <ul className="theme-risk-list">
            {entries.map((entry) => (
              <li className="theme-risk-row" key={entry.themeId}>
                <span className="theme-risk-row__label" title={entry.label}>
                  {entry.label}
                </span>
                <span className="theme-risk-row__score">
                  {entry.score} · {entry.negativeCount}/{entry.messageCount} négatifs
                </span>
                {hasTrend && <ThemeRiskTrendBadge trend={entry.trend} />}
              </li>
            ))}
          </ul>
          {!hasTrend && (
            <p className="net-score-comparison net-score-comparison--hint">
              Sélectionnez une période pour comparer au score de risque de la période précédente.
            </p>
          )}
        </>
      ) : (
        <p className="empty-state">
          Aucun message classé en thème et en sentiment pour l&apos;instant.
        </p>
      )}
    </div>
  );
}

// Sens inversé par rapport au score de sentiment net : ici une hausse du
// score est une dégradation (rouge/Error) et une baisse une amélioration
// (vert/Success) — ne pas réutiliser NetScoreComparisonBadge tel quel (voir
// design.md, Decision 4).
function ThemeRiskTrendBadge({ trend }: { trend: number | null }) {
  if (trend === null) return null;

  const variant = trend > 0 ? "worse" : trend < 0 ? "better" : "stable";
  const arrow = trend > 0 ? "▲" : trend < 0 ? "▼" : "–";
  const formatted = trend > 0 ? `+${trend}` : `${trend}`;

  return (
    <span className={`theme-risk-trend theme-risk-trend--${variant}`}>
      <span aria-hidden="true">{arrow}</span> {formatted} pts
    </span>
  );
}
