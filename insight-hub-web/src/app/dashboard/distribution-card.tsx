import type { DistributionEntry } from "@/db/message-distribution";

export function DistributionCard({
  kicker,
  title,
  emptyMessage,
  entries,
}: {
  kicker: string;
  title: string;
  emptyMessage: string;
  entries: DistributionEntry[];
}) {
  return (
    <div className="card">
      <span className="kicker">{kicker}</span>
      <h2>{title}</h2>
      {entries.length > 0 ? (
        <div className="bar-list">
          {entries.map((entry) => (
            <div className="bar-row" key={entry.label}>
              <span className="bar-row__label" title={entry.label}>
                {entry.label}
              </span>
              <span className="bar-row__track">
                <span
                  className="bar-row__fill"
                  style={{ width: `${Math.max(entry.share * 100, 2)}%` }}
                />
              </span>
              <span className="bar-row__value">{entry.messageCount}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="empty-state">{emptyMessage}</p>
      )}
    </div>
  );
}
