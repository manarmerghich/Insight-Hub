import { getLatestImportRun } from "@/db/latest-import-run";
import { getCountryDistribution, getPlatformDistribution } from "@/db/message-distribution";
import {
  getDailyNetSentimentEvolution,
  getNetSentimentScore,
  NET_SENTIMENT_SOURCE,
} from "@/db/net-sentiment-score";

import { DistributionCard } from "./distribution-card";
import { NetSentimentCard } from "./net-sentiment-card";

// Toujours lire les données à la demande : le sentiment se calcule
// automatiquement en tâche de fond juste après l'import (voir
// ai-sentiment-analysis), donc la page ne doit jamais servir un rendu mis en
// cache qui daterait d'avant cette classification.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const latestRun = await getLatestImportRun();
  const runId = latestRun?.id ?? null;

  const [score, evolution, platforms, countries] = await Promise.all([
    getNetSentimentScore(runId),
    getDailyNetSentimentEvolution(runId),
    getPlatformDistribution(runId),
    getCountryDistribution(runId),
  ]);

  return (
    <main className="dashboard-main">
      <div className="dashboard-grid">
        {latestRun ? (
          <p className="dashboard-scope">
            Basé sur le dernier import : <strong>{latestRun.keyword}</strong> (
            {latestRun.sourceFilename}, {formatDate(latestRun.startedAt)})
          </p>
        ) : (
          <p className="empty-state">Aucun import réalisé pour l&apos;instant.</p>
        )}
        <NetSentimentCard score={score} evolution={evolution} source={NET_SENTIMENT_SOURCE} />
        <div className="dashboard-grid dashboard-grid--split">
          <DistributionCard
            kicker="Répartition"
            title="Messages par plateforme"
            emptyMessage="Aucun message importé pour l'instant."
            entries={platforms}
          />
          <DistributionCard
            kicker="Répartition"
            title="Messages par pays"
            emptyMessage="Aucun message importé pour l'instant."
            entries={countries}
          />
        </div>
      </div>
    </main>
  );
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(date);
}
