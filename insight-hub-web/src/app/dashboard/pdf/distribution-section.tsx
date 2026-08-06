import { Text, View } from "@react-pdf/renderer";

import type { CountryDistributionEntry, DistributionEntry } from "@/db/message-distribution";

import { styles } from "./styles";

// Plateformes et pays partagent la même condition d'absence de données
// (les deux proviennent du même scope de messages, voir
// message-distribution.ts) : un scope vide vide simultanément les deux
// listes, une seule mention d'absence couvre donc les deux graphiques
// (voir pdf-export, Requirement "PDF Includes Platform And Country
// Distribution Charts").
export function DistributionSection({
  platforms,
  countries,
}: {
  platforms: DistributionEntry[];
  countries: CountryDistributionEntry[];
}) {
  const hasData = platforms.length > 0 || countries.length > 0;

  return (
    <View style={styles.section}>
      <Text style={styles.kicker}>Répartition</Text>
      <Text style={styles.heading}>Répartitions par plateforme et par pays</Text>
      {!hasData ? (
        <Text style={styles.emptyState}>Aucun message dans ce scope.</Text>
      ) : (
        <View style={styles.distributionColumns}>
          <DistributionList title="Par plateforme" entries={platforms} />
          <DistributionList title="Par pays" entries={countries} />
        </View>
      )}
    </View>
  );
}

function DistributionList({
  title,
  entries,
}: {
  title: string;
  entries: DistributionEntry[];
}) {
  return (
    <View style={styles.distributionColumn}>
      <Text style={styles.subheading}>{title}</Text>
      {entries.map((entry) => (
        <View key={entry.label} style={styles.barRow}>
          <Text style={styles.barRowLabel}>{entry.label}</Text>
          <View style={styles.barRowTrack}>
            <View style={[styles.barRowFill, { width: `${Math.max(entry.share * 100, 2)}%` }]} />
          </View>
          <Text style={styles.barRowValue}>{entry.messageCount}</Text>
        </View>
      ))}
    </View>
  );
}
