## 1. Requête de données

- [x] 1.1 Créer `src/db/representative-messages.ts` avec une fonction `getRepresentativeMessagesByThemeAndSentiment(runId, filters)` qui retourne, pour chaque thème du référentiel (`themes`) et chaque catégorie de sentiment (positif/négatif/neutre), le message représentatif ou `null`.
- [x] 1.2 Réutiliser `dashboardFilterConditions(filters, sentimentSource)` (sans `{ includeTheme: false }`, contrairement à `theme-ranking.ts`) pour appliquer les 5 dimensions de filtre croisé sans exception thème.
- [x] 1.3 Déterminer `sentimentSource` ("ai" ou "csv_original") de la même façon que `net-sentiment-score.ts` / `engagement-rate.ts` (mode IA actif vs mode provisoire), en réutilisant leur logique existante plutôt que de la dupliquer.
- [x] 1.4 Implémenter la sélection du message le plus engageant par combinaison thème/sentiment avec le critère `coalesce(likes,0) + coalesce(retweets,0)` desc puis `id` asc en cas d'égalité (même critère que `getRepresentativeMessage` dans `sentiment-timeline-peaks.ts`).
- [x] 1.5 Restreindre aux messages avec `theme_status = 'completed'` et à la même condition de complétude de sentiment que la source active (`sentiment_status = 'completed'` en mode IA, présence de `sentiment_original` reconnu en mode provisoire).
- [x] 1.6 Scoper au dernier run d'import ayant des messages (réutiliser `runId` déjà résolu par `getLatestImportRun` dans `page.tsx`, comme les autres KPIs) ; retourner une structure vide (toutes combinaisons à `null`) si `runId` est `null`.
- [x] 1.7 Retourner une structure par thème (id, libellé) avec les 3 entrées de sentiment (message représentatif ou `null`), plutôt qu'une liste plate, pour correspondre à la grille d'affichage.

## 2. Tests de la couche données

- [x] 2.1 Ajouter `src/db/representative-messages.test.ts` (pattern `sentiment-timeline-peaks.test.ts` / `dashboard-filters.test.ts`) couvrant les fonctions pures extraites (`isMoreRepresentative`, `resolveSentimentLabel`) : sélection du message le plus engageant, égalité départagée par id le plus petit, mode provisoire vs mode IA. Les scénarios de scope (run d'import, filtres croisés) reposent sur `dashboardFilterConditions`/`NET_SENTIMENT_SOURCE` déjà couverts par leurs propres tests — pas de test d'intégration base de données, comme pour `theme-ranking.ts`/`engagement-rate.ts`.
- [x] 2.2 Vérifier que `likes`/`retweets` nuls sont bien traités comme 0 dans le critère d'engagement.

## 3. Composant d'affichage

- [x] 3.1 Créer `src/app/dashboard/representative-messages-card.tsx` affichant une grille thème (lignes) × sentiment (colonnes Positif/Négatif/Neutre), réutilisant les libellés de sentiment (`SENTIMENT_LABELS`) et le rendu de message existant (texte, auteur, plateforme, date) déjà utilisés dans `message-search-results.tsx`.
- [x] 3.2 Réutiliser le composant `FavoriteButton` existant pour le contrôle favori de chaque message affiché dans une cellule.
- [x] 3.3 Afficher un état vide explicite par cellule sans message ("Aucun message classé"), et un état vide global du widget si aucune combinaison n'a de message.
- [x] 3.4 Reprendre les classes CSS existantes (`card`, `kicker`, `subtitle`, `empty-state`, styles de `message-row`) plutôt que d'introduire une nouvelle bibliothèque UI ; ajouter dans `globals.css` uniquement les classes de grille manquantes, avec la palette de couleurs existante.
- [x] 3.5 Vérifier la responsivité de la grille sur mobile (colonnes empilées ou défilement horizontal contrôlé).

## 4. Intégration dans le dashboard

- [x] 4.1 Appeler `getRepresentativeMessagesByThemeAndSentiment(runId, filters)` dans `src/app/dashboard/page.tsx`, en l'ajoutant au `Promise.all` existant avec les autres KPIs.
- [x] 4.2 Insérer `<RepresentativeMessagesCard />` dans la grille du dashboard, à proximité de `TopThemesCard` (même thématique thèmes).

## 5. Vérification manuelle

- [x] 5.1 Lancer l'app (voir skill `run`) et vérifier avec Playwright : affichage correct de la grille avec données réelles, état vide par cellule, effet des filtres croisés (dont le filtre thème, qui restreint bien ce widget contrairement au classement des thèmes), rendu responsive (défilement horizontal sur mobile). Vérifié en conditions réelles sur la base Neon partagée : 7 thèmes × 3 sentiments, 12/21 cellules avec message hors filtre, 2/21 avec le filtre thème actif, aucune erreur console. État vide global et bascule favori vérifiés par lecture de code (mêmes composants/logique que les KPIs existants déjà couverts par `message-favorites`), non exercés en direct pour ne pas muter les données partagées.
