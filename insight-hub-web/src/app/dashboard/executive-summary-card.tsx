export function ExecutiveSummaryCard({
  hasImport,
  summary,
}: {
  hasImport: boolean;
  summary: string | null;
}) {
  return (
    <div className="card">
      <span className="kicker">Synthèse</span>
      <h2>Résumé exécutif</h2>
      <p className="subtitle">
        Synthèse en langage naturel générée à partir des KPIs déjà calculés ci-dessous — pas une
        nouvelle analyse des messages bruts.
      </p>
      {!hasImport ? (
        <p className="empty-state">Aucun import réalisé pour l&apos;instant.</p>
      ) : summary ? (
        <p className="executive-summary-text">{summary}</p>
      ) : (
        <p className="empty-state">Résumé indisponible pour le moment.</p>
      )}
    </div>
  );
}
