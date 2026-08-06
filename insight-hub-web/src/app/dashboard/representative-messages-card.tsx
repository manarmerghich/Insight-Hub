import { Fragment } from "react";

import type { RepresentativeMessage, ThemeRepresentativeMessages } from "@/db/representative-messages";
import { SENTIMENT_LABELS } from "@/db/representative-messages";

import { FavoriteButton } from "./favorite-button";

const SENTIMENT_COLUMN_LABELS: Record<(typeof SENTIMENT_LABELS)[number], string> = {
  positif: "Positif",
  négatif: "Négatif",
  neutre: "Neutre",
};

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function RepresentativeMessageCell({ message }: { message: RepresentativeMessage | null }) {
  if (!message) {
    return <p className="empty-state empty-state--compact">Aucun message classé.</p>;
  }

  return (
    <div className="rep-grid__message">
      <div className="rep-grid__message-header">
        <span className="message-row__user">{message.user}</span>
        <span className="message-row__platform">{message.platform}</span>
        <FavoriteButton messageId={message.id} initialIsFavorite={message.isFavorite} />
      </div>
      <p className="rep-grid__message-text">{message.text}</p>
      <div className="rep-grid__message-footer">
        <span>{formatDate(message.timestamp)}</span>
        <span>
          ♥ {message.likes ?? 0} · ↺ {message.retweets ?? 0}
        </span>
      </div>
    </div>
  );
}

export function RepresentativeMessagesCard({
  entries,
}: {
  entries: ThemeRepresentativeMessages[];
}) {
  const hasAnyMessage = entries.some((theme) =>
    SENTIMENT_LABELS.some((sentiment) => theme.bySentiment[sentiment] !== null),
  );

  return (
    <div className="card">
      <span className="kicker">Thèmes &amp; sentiment</span>
      <h2>Messages représentatifs</h2>
      <p className="subtitle">
        Pour chaque thème et chaque sentiment, le message classé le plus engageant (likes +
        retweets) du dernier run d&apos;import.
      </p>
      {hasAnyMessage ? (
        <div className="rep-grid-wrap">
          <div className="rep-grid">
            <div className="rep-grid__corner" />
            {SENTIMENT_LABELS.map((sentiment) => (
              <div className="rep-grid__col-header" key={sentiment}>
                {SENTIMENT_COLUMN_LABELS[sentiment]}
              </div>
            ))}
            {entries.map((theme) => (
              <Fragment key={theme.themeId}>
                <div className="rep-grid__row-header" title={theme.label}>
                  {theme.label}
                </div>
                {SENTIMENT_LABELS.map((sentiment) => (
                  <div className="rep-grid__cell" key={`${theme.themeId}-${sentiment}`}>
                    <RepresentativeMessageCell message={theme.bySentiment[sentiment]} />
                  </div>
                ))}
              </Fragment>
            ))}
          </div>
        </div>
      ) : (
        <p className="empty-state">Aucun message classé pour l&apos;instant.</p>
      )}
    </div>
  );
}
