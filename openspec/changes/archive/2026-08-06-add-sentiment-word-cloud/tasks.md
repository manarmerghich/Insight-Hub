## 1. Extraction de mots (fonctions pures)

- [x] 1.1 Créer `src/db/sentiment-word-cloud.ts` avec la constante `STOP_WORDS` (mots vides anglais courants, best-effort, commentaire renvoyant vers `original-sentiment-mapping.ts` pour le précédent) et les constantes ajustables `MIN_WORD_LENGTH` (3) et `MAX_WORDS_PER_CATEGORY` (30)
- [x] 1.2 Implémenter `tokenize(text: string): string[]` (minuscules, découpage unicode-aware sur non-lettres/chiffres, exclusion des tokens < `MIN_WORD_LENGTH`, exclusion des tokens entièrement numériques, exclusion des `STOP_WORDS`)
- [x] 1.3 Implémenter `rankWordFrequencies(tokens: string[]): { word: string; count: number }[]` (comptage, tri par fréquence décroissante puis alphabétique croissant en cas d'égalité, troncature à `MAX_WORDS_PER_CATEGORY`)
- [x] 1.4 Écrire `sentiment-word-cloud.test.ts` couvrant : tokenisation (ponctuation/emojis/accents/majuscules), exclusion des mots courts et numériques, exclusion des mots vides, classement par fréquence avec égalités, troncature au maximum

## 2. Requête d'agrégation par sentiment

- [x] 2.1 Implémenter `getSentimentWordCloud(runId: number | null, filters: DashboardFilters)` dans `src/db/sentiment-word-cloud.ts`, suivant le pattern de `engagement-rate.ts`/`representative-messages.ts` : réutiliser `NET_SENTIMENT_SOURCE`, `resolveSentimentLabel`/`mapOriginalSentimentToCategory`, `dashboardFilterConditions(filters, NET_SENTIMENT_SOURCE)`, ne sélectionner que les colonnes `text` et de sentiment nécessaires
- [x] 2.2 Regrouper les lignes chargées par catégorie de sentiment (positif/négatif/neutre), tokeniser le texte de chaque message avec `tokenize`, agréger les tokens par catégorie puis appliquer `rankWordFrequencies`
- [x] 2.3 Retourner une entrée pour chacune des trois catégories même sans message classé ni mot retenu (liste de mots vide plutôt qu'omission), avec `runId === null` retournant les trois catégories vides sans requête

## 3. Composant dashboard

- [x] 3.1 Créer `src/app/dashboard/sentiment-word-cloud-card.tsx` : une carte par catégorie de sentiment (ou une carte unique à trois sections), rendu des mots en `flex-wrap` avec taille de police interpolée entre une borne min et max selon la fréquence relative au mot le plus fréquent de sa catégorie
- [x] 3.2 Couleur de mot cohérente avec la palette existante par catégorie (Success/Error/Text pour positif/négatif/neutre, en respectant les règles de contraste WCAG AA déjà en vigueur sur le dashboard)
- [x] 3.3 État vide explicite par catégorie sans mot extrait, réutilisant le style `empty-state` existant

## 4. Branchement dashboard et filtres croisés

- [x] 4.1 Appeler `getSentimentWordCloud` dans `src/app/dashboard/page.tsx` (dans le même `Promise.all` que les autres KPIs) et rendre `SentimentWordCloudCard`
- [x] 4.2 Vérifier que les cinq filtres croisés (période, plateforme, pays, sentiment, thème) restreignent bien l'extraction de mots, y compris le cas où le filtre sentiment isole une seule catégorie non vide

## 5. Vérification finale

- [x] 5.1 Lancer la suite Vitest (`npm run test` dans `insight-hub-web`) et vérifier que tous les tests passent
- [x] 5.2 Tester le dashboard avec Playwright : nuage de mots par sentiment visible pour un run importé, comportement correct avec et sans filtres croisés actifs, rendu responsive, sans erreur console
