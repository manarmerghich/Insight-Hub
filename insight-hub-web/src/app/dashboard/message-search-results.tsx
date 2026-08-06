import type { MessageSearchResult } from "@/db/message-search";

import { FavoriteButton } from "./favorite-button";

const SENTIMENT_LABELS: Record<string, string> = {
  positif: "Positif",
  négatif: "Négatif",
  neutre: "Neutre",
};

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function MessageSearchResults({
  results,
  totalCount,
  isTruncated,
}: {
  results: MessageSearchResult[];
  totalCount: number;
  isTruncated: boolean;
}) {
  return (
    <div className="card">
      <span className="kicker">Recherche &amp; favoris</span>
      <h2>Messages</h2>
      {results.length > 0 ? (
        <>
          {isTruncated && (
            <p className="provisional-notice">
              {totalCount} messages correspondent — seuls les {results.length} plus pertinents sont
              affichés. Affinez votre recherche ou vos filtres pour voir les autres.
            </p>
          )}
          <ul className="message-list">
            {results.map((message) => (
              <li className="message-row" key={message.id}>
                <div className="message-row__header">
                  <span className="message-row__user">{message.user}</span>
                  <span className="message-row__platform">{message.platform}</span>
                  {message.sentiment && SENTIMENT_LABELS[message.sentiment] && (
                    <span className={`message-row__sentiment message-row__sentiment--${message.sentiment}`}>
                      {SENTIMENT_LABELS[message.sentiment]}
                    </span>
                  )}
                  <span className="message-row__date">{formatDate(message.timestamp)}</span>
                  <FavoriteButton messageId={message.id} initialIsFavorite={message.isFavorite} />
                </div>
                <p className="message-row__text">{message.text}</p>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="empty-state">Aucun message ne correspond à cette recherche.</p>
      )}
    </div>
  );
}
