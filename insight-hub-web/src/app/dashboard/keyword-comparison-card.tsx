import type { CountryDistributionEntry, DistributionEntry } from "@/db/message-distribution";
import type { ThemeRankingEntry } from "@/db/theme-ranking";

import { KeywordComparisonSelect } from "./keyword-comparison-select";

function formatShare(share: number): string {
  return share.toLocaleString("fr-FR", { style: "percent", maximumFractionDigits: 0 });
}

// Restitution pure des KPIs déjà calculés (score net, répartitions,
// thèmes) — mêmes libellés/formats que NetSentimentCard/DistributionCard/
// TopThemesCard, sans instancier ces composants (voir design.md, Decision
// "Un nouveau composant carte dédié").
function ScoreValue({ score }: { score: number | null }) {
  if (score === null) {
    return <p className="empty-state empty-state--compact">Score indisponible.</p>;
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

function MiniDistribution({
  entries,
  emptyMessage,
}: {
  entries: DistributionEntry[];
  emptyMessage: string;
}) {
  if (entries.length === 0) {
    return <p className="empty-state empty-state--compact">{emptyMessage}</p>;
  }

  return (
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
  );
}

function MiniThemeRanking({ entries }: { entries: ThemeRankingEntry[] }) {
  if (entries.length === 0) {
    return <p className="empty-state empty-state--compact">Aucun thème classé pour l&apos;instant.</p>;
  }

  return (
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
  );
}

function ComparisonColumn({
  label,
  score,
  platforms,
  countries,
  themes,
}: {
  label: string;
  score: number | null;
  platforms: DistributionEntry[];
  countries: CountryDistributionEntry[];
  themes: ThemeRankingEntry[];
}) {
  return (
    <div className="keyword-comparison-column">
      <h3 className="keyword-comparison-column__heading" title={label}>
        {label}
      </h3>
      <section className="keyword-comparison-column__section">
        <span className="kicker">Sentiment</span>
        <ScoreValue score={score} />
      </section>
      <section className="keyword-comparison-column__section">
        <span className="kicker">Plateformes</span>
        <MiniDistribution entries={platforms} emptyMessage="Aucun message importé pour l'instant." />
      </section>
      <section className="keyword-comparison-column__section">
        <span className="kicker">Pays</span>
        <MiniDistribution entries={countries} emptyMessage="Aucun message importé pour l'instant." />
      </section>
      <section className="keyword-comparison-column__section">
        <span className="kicker">Thèmes</span>
        <MiniThemeRanking entries={themes} />
      </section>
    </div>
  );
}

export function KeywordComparisonCard({
  comparableKeywords,
  compareKeyword,
  compareRunId,
  currentKeyword,
  currentScore,
  currentPlatforms,
  currentCountries,
  currentThemes,
  compareScore,
  comparePlatforms,
  compareCountries,
  compareThemes,
}: {
  comparableKeywords: string[];
  compareKeyword: string | null;
  compareRunId: number | null;
  currentKeyword: string;
  currentScore: number | null;
  currentPlatforms: DistributionEntry[];
  currentCountries: CountryDistributionEntry[];
  currentThemes: ThemeRankingEntry[];
  compareScore: number | null;
  comparePlatforms: DistributionEntry[];
  compareCountries: CountryDistributionEntry[];
  compareThemes: ThemeRankingEntry[];
}) {
  return (
    <div className="card">
      <span className="kicker">Comparaison</span>
      <h2>Comparer avec un autre mot-clé</h2>
      <p className="subtitle">
        Score net, répartitions plateforme/pays et classement des thèmes, côte à côte — mêmes
        filtres croisés des deux côtés, aucun nouveau calcul.
      </p>
      <KeywordComparisonSelect comparableKeywords={comparableKeywords} />
      {compareKeyword && compareRunId === null && (
        <p className="empty-state">
          Aucun import disponible pour le mot-clé « {compareKeyword} ».
        </p>
      )}
      {compareKeyword && compareRunId !== null && (
        <div className="dashboard-grid dashboard-grid--split keyword-comparison-columns">
          <ComparisonColumn
            label={currentKeyword}
            score={currentScore}
            platforms={currentPlatforms}
            countries={currentCountries}
            themes={currentThemes}
          />
          <ComparisonColumn
            label={compareKeyword}
            score={compareScore}
            platforms={comparePlatforms}
            countries={compareCountries}
            themes={compareThemes}
          />
        </div>
      )}
    </div>
  );
}
