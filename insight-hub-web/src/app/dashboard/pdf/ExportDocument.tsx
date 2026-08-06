import { Document, Page, Text } from "@react-pdf/renderer";

import type { CountryDistributionEntry, DistributionEntry } from "@/db/message-distribution";
import type { MessageSearchResult } from "@/db/message-search";
import type { DailyNetSentiment } from "@/db/net-sentiment-score";

import { DistributionSection } from "./distribution-section";
import { ExecutiveSummarySection } from "./executive-summary-section";
import { FavoritesSection } from "./favorites-section";
import { NetSentimentSection } from "./net-sentiment-section";
import { styles } from "./styles";

export type ExportDocumentProps = {
  generatedAt: Date;
  summary: string | null;
  score: number | null;
  evolution: DailyNetSentiment[];
  platforms: DistributionEntry[];
  countries: CountryDistributionEntry[];
  favorites: MessageSearchResult[];
  favoritesIsTruncated: boolean;
};

function formatGeneratedAt(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" }).format(date);
}

// Document racine du rapport PDF enrichi — quatre sections, dans l'ordre du
// dashboard (résumé, score net + évolution, répartitions, favoris), voir
// pdf-export, proposal.md § "What Changes". Composants @react-pdf/renderer
// distincts des composants dashboard existants (voir design.md, Decision
// "Composants PDF dédiés").
export function ExportDocument({
  generatedAt,
  summary,
  score,
  evolution,
  platforms,
  countries,
  favorites,
  favoritesIsTruncated,
}: ExportDocumentProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Insight Hub — Rapport d&apos;analyse</Text>
        <Text style={styles.subtitle}>
          Généré le {formatGeneratedAt(generatedAt)}, à partir du scope de filtres actif sur le
          dashboard.
        </Text>
        <ExecutiveSummarySection summary={summary} />
        <NetSentimentSection score={score} evolution={evolution} />
        <DistributionSection platforms={platforms} countries={countries} />
        <FavoritesSection favorites={favorites} isTruncated={favoritesIsTruncated} />
      </Page>
    </Document>
  );
}
