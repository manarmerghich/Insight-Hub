import { and, eq, type SQL } from "drizzle-orm";

import { db } from "@/db/client";
import { messages } from "@/db/schema";
import { dashboardFilterConditions, type DashboardFilters } from "@/db/dashboard-filters";
import type { SentimentLabel } from "@/db/engagement-rate";
import { NET_SENTIMENT_SOURCE } from "@/db/net-sentiment-score";
import { resolveSentimentLabel, SENTIMENT_LABELS } from "@/db/representative-messages";

export type WordFrequency = { word: string; count: number };

export type SentimentWordCloudEntry = {
  sentiment: SentimentLabel;
  words: WordFrequency[];
};

// Longueur minimale d'un token retenu : élimine une grande partie des mots
// vides courts sans dépendre de la langue ("a", "is", "to", "le", "et"...).
// Constante isolée, ajustable sans changer l'architecture (voir design.md).
export const MIN_WORD_LENGTH = 3;

// Volume maximal de mots restitués par catégorie de sentiment. Constante
// ajustable si le retour visuel après implémentation suggère un autre volume.
export const MAX_WORDS_PER_CATEGORY = 30;

// Mots vides anglais courants (articles, pronoms, auxiliaires,
// prépositions...), best-effort à l'image de POSITIVE_LABELS/NEGATIVE_LABELS
// dans original-sentiment-mapping.ts : le contenu importé n'a pas de langue
// garantie (voir schema.ts, choix de la config 'simple' pour search_vector).
// N'exclut pas les mots vides d'une autre langue si le contenu importé
// change de langue à l'avenir — non-goal explicite du design de cette
// fonctionnalité. Les contractions ("don't", "isn't"...) sont découpées par
// tokenize sur l'apostrophe : seuls les fragments résultants d'au moins
// MIN_WORD_LENGTH caractères ("don", "isn"...) ont besoin d'être listés ici,
// les fragments plus courts ("t", "s", "ve"...) sont déjà exclus par le
// filtre de longueur.
export const STOP_WORDS = new Set([
  "a", "about", "above", "after", "again", "against", "all", "am", "an",
  "and", "any", "are", "aren", "as", "at", "be", "because", "been",
  "before", "being", "below", "between", "both", "but", "by", "can",
  "cannot", "could", "couldn", "did", "didn", "do", "does", "doesn",
  "doing", "don", "down", "during", "each", "few", "for", "from",
  "further", "had", "hadn", "has", "hasn", "have", "haven", "having",
  "he", "her", "here", "hers", "herself", "him", "himself", "his", "how",
  "if", "in", "into", "is", "isn", "it", "its", "itself", "just", "let",
  "me", "more", "most", "mustn", "my", "myself", "no", "nor", "not",
  "now", "of", "off", "on", "once", "only", "or", "other", "ought",
  "our", "ours", "ourselves", "out", "over", "own", "same", "shan",
  "she", "should", "shouldn", "so", "some", "such", "than", "that",
  "the", "their", "theirs", "them", "themselves", "then", "there",
  "these", "they", "this", "those", "through", "to", "too", "under",
  "until", "up", "very", "was", "wasn", "we", "were", "weren", "what",
  "when", "where", "which", "while", "who", "whom", "why", "will",
  "with", "won", "would", "wouldn", "you", "your", "yours", "yourself",
  "yourselves",
]);

// Découpage unicode-aware : tout ce qui n'est pas une lettre ou un chiffre
// devient une frontière de mot, pour ne pas casser les caractères accentués.
const WORD_SPLIT_PATTERN = /[^\p{L}\p{N}]+/u;
const NUMERIC_TOKEN_PATTERN = /^\p{N}+$/u;

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(WORD_SPLIT_PATTERN)
    .filter((token) => token.length >= MIN_WORD_LENGTH)
    .filter((token) => !NUMERIC_TOKEN_PATTERN.test(token))
    .filter((token) => !STOP_WORDS.has(token));
}

export function rankWordFrequencies(tokens: string[]): WordFrequency[] {
  const counts = new Map<string, number>();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  return Array.from(counts, ([word, count]) => ({ word, count }))
    .sort((a, b) => (b.count !== a.count ? b.count - a.count : a.word.localeCompare(b.word)))
    .slice(0, MAX_WORDS_PER_CATEGORY);
}

function emptyWordCloud(): SentimentWordCloudEntry[] {
  return SENTIMENT_LABELS.map((sentiment) => ({ sentiment, words: [] }));
}

// Même scope et même source de sentiment que les autres KPIs par catégorie
// (voir engagement-rate.ts, representative-messages.ts) : dernier run
// d'import, classification IA si active sinon mapping provisoire de
// sentiment_original, restreint par les filtres croisés actifs. Ne
// sélectionne que le texte et les colonnes de sentiment nécessaires — pas la
// ligne complète (ex. hashtags volontairement exclus, voir design.md).
export async function getSentimentWordCloud(
  runId: number | null,
  filters: DashboardFilters,
): Promise<SentimentWordCloudEntry[]> {
  if (runId === null) return emptyWordCloud();

  const conditions = [
    eq(messages.runId, runId),
    NET_SENTIMENT_SOURCE === "ai" ? eq(messages.sentimentStatus, "completed") : undefined,
    ...dashboardFilterConditions(filters, NET_SENTIMENT_SOURCE),
  ].filter((condition): condition is SQL => condition !== undefined);

  const rows = await db
    .select({
      text: messages.text,
      sentiment: messages.sentiment,
      sentimentOriginal: messages.sentimentOriginal,
    })
    .from(messages)
    .where(and(...conditions));

  const tokensBySentiment = new Map<SentimentLabel, string[]>();
  for (const row of rows) {
    const label = resolveSentimentLabel(NET_SENTIMENT_SOURCE, row);
    if (!label) continue;

    const tokens = tokensBySentiment.get(label) ?? [];
    tokens.push(...tokenize(row.text));
    tokensBySentiment.set(label, tokens);
  }

  return SENTIMENT_LABELS.map((sentiment) => ({
    sentiment,
    words: rankWordFrequencies(tokensBySentiment.get(sentiment) ?? []),
  }));
}
