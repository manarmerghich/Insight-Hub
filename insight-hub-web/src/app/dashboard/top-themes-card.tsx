import type { ThemeRankingEntry } from "@/db/theme-ranking";

function formatShare(share: number): string {
  return share.toLocaleString("fr-FR", { style: "percent", maximumFractionDigits: 0 });
}

export function TopThemesCard({ entries }: { entries: ThemeRankingEntry[] }) {
  return (
    <div className="card">
      <span className="kicker">Thèmes</span>
      <h2>Top thèmes</h2>
      <p className="subtitle">
        Classement des thèmes du référentiel par nombre de messages classés.
      </p>
      {entries.length > 0 ? (
        <div className="bar-list">
          {entries.map((entry) => (
            <div className="bar-row" key={entry.themeId}>
              <span className="bar-row__label" title={entry.label}>
                {entry.label}
              </span>
              <span className="bar-row__track">
                <span
                  className="bar-row__fill"
                  style={{ width: `${Math.max(entry.share * 100, 2)}%` }}
                />
              </span>
              <span className="bar-row__value">
                {entry.messageCount} · {formatShare(entry.share)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="empty-state">Aucun thème classé pour l&apos;instant.</p>
      )}
    </div>
  );
}
