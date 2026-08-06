import { Text, View } from "@react-pdf/renderer";

import { styles } from "./styles";

// Restitution pure du résumé déjà en cache pour ce scope (voir
// pdf-export, Requirement "PDF Includes Executive Summary Without
// Triggering AI Generation") — jamais de génération IA depuis ce
// composant, qui ne fait qu'afficher ce que la route lui transmet.
export function ExecutiveSummarySection({ summary }: { summary: string | null }) {
  return (
    <View style={styles.section}>
      <Text style={styles.kicker}>Synthèse</Text>
      <Text style={styles.heading}>Résumé exécutif</Text>
      {summary ? (
        <Text style={styles.bodyText}>{summary}</Text>
      ) : (
        <Text style={styles.emptyState}>Résumé indisponible pour ce scope.</Text>
      )}
    </View>
  );
}
