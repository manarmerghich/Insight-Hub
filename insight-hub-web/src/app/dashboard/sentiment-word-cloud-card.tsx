import type { SentimentLabel } from "@/db/engagement-rate";
import type { SentimentWordCloudEntry, WordFrequency } from "@/db/sentiment-word-cloud";

const SECTION_LABELS: Record<SentimentLabel, string> = {
  positif: "Positif",
  négatif: "Négatif",
  neutre: "Neutre",
};

// Taille de police interpolée linéairement entre ces bornes selon la
// fréquence relative au mot le plus fréquent de sa catégorie (voir
// design.md) — pas de bibliothèque de nuage de mots, un simple flux de
// <span> en flex-wrap.
const MIN_WORD_FONT_REM = 0.85;
const MAX_WORD_FONT_REM = 2;

function wordFontSize(count: number, maxCount: number): string {
  const ratio = maxCount > 0 ? count / maxCount : 0;
  const size = MIN_WORD_FONT_REM + ratio * (MAX_WORD_FONT_REM - MIN_WORD_FONT_REM);
  return `${size.toFixed(2)}rem`;
}

function WordCloudSection({
  sentiment,
  words,
}: {
  sentiment: SentimentLabel;
  words: WordFrequency[];
}) {
  const maxCount = words.reduce((max, word) => Math.max(max, word.count), 0);

  return (
    <div className="word-cloud-section">
      <span className={`word-cloud-section__label word-cloud-section__label--${sentiment}`}>
        {SECTION_LABELS[sentiment]}
      </span>
      {words.length > 0 ? (
        <div className="word-cloud-section__words">
          {words.map((word) => (
            <span
              className={`word-cloud-word word-cloud-word--${sentiment}`}
              key={word.word}
              style={{ fontSize: wordFontSize(word.count, maxCount) }}
              title={`${word.word} · ${word.count}`}
            >
              {word.word}
            </span>
          ))}
        </div>
      ) : (
        <p className="empty-state empty-state--compact">Aucun mot extrait.</p>
      )}
    </div>
  );
}

export function SentimentWordCloudCard({ entries }: { entries: SentimentWordCloudEntry[] }) {
  const hasAnyWord = entries.some((entry) => entry.words.length > 0);

  return (
    <div className="card">
      <span className="kicker">Vocabulaire</span>
      <h2>Nuage de mots par sentiment</h2>
      <p className="subtitle">
        Mots les plus fréquents du texte des messages déjà classés du dernier import, par
        catégorie de sentiment.
      </p>
      {hasAnyWord ? (
        <div className="word-cloud">
          {entries.map((entry) => (
            <WordCloudSection
              key={entry.sentiment}
              sentiment={entry.sentiment}
              words={entry.words}
            />
          ))}
        </div>
      ) : (
        <p className="empty-state">Aucun mot extrait pour l&apos;instant.</p>
      )}
    </div>
  );
}
