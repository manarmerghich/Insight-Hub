import { Text, View } from "@react-pdf/renderer";

import type { MessageSearchResult } from "@/db/message-search";

import { SENTIMENT_LABELS, styles } from "./styles";

// Réutilise à l'identique getMessageSearchResults(runId, { ...filters,
// favoritesOnly: true }), déjà plafonné à MESSAGE_SEARCH_RESULT_CAP côté
// route — voir pdf-export, Requirement "PDF Includes Favorite Messages
// Of The Latest Import Run".
export function FavoritesSection({
  favorites,
  isTruncated,
}: {
  favorites: MessageSearchResult[];
  isTruncated: boolean;
}) {
  return (
    <View style={[styles.section, styles.sectionLast]}>
      <Text style={styles.kicker}>Recherche &amp; favoris</Text>
      <Text style={styles.heading}>Messages favoris</Text>
      {favorites.length === 0 ? (
        <Text style={styles.emptyState}>Aucun favori dans ce scope.</Text>
      ) : (
        <>
          {isTruncated && (
            <Text style={styles.notice}>
              Liste tronquée : seuls les {favorites.length} favoris les plus récents de ce scope sont
              listés ci-dessous.
            </Text>
          )}
          {favorites.map((message) => (
            <View key={message.id} style={styles.messageRow}>
              <Text style={styles.messageRowHeader}>
                {message.user} · {message.platform}
                {message.sentiment && SENTIMENT_LABELS[message.sentiment]
                  ? ` · ${SENTIMENT_LABELS[message.sentiment]}`
                  : ""}
              </Text>
              <Text style={styles.messageRowText}>{message.text}</Text>
            </View>
          ))}
        </>
      )}
    </View>
  );
}
