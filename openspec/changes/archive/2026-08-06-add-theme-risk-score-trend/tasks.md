## 1. Module de calcul (`src/db/theme-risk-score.ts`)

- [x] 1.1 Créer le module `theme-risk-score.ts` avec un type exporté `ThemeRiskScoreEntry` (`themeId`, `label`, `messageCount`, `negativeCount`, `score`, `trend: number | null`)
- [x] 1.2 Implémenter une fonction pure `computeThemeRiskScore(messageCount, negativeCount, totalMessagesClassifiés)` (score = part de volume × part de négatif × 100, arrondi comme `computeNetScore`) réutilisable et testable indépendamment de la requête SQL
- [x] 1.3 Implémenter `getThemeRiskScores(runId, filters)` : requête sur `themes` LEFT JOIN `messages` avec `theme_status = 'completed'` ET `sentiment_status = 'completed'` ET `run_id = runId`, en appliquant `dashboardFilterConditions(filters, "ai", { includeTheme: false })` (même pattern que `theme-ranking.ts`), regroupée par thème, avec total tous thèmes confondus calculé une fois pour dériver la part de volume de chaque thème
- [x] 1.4 Gérer le cas `runId === null` → tableau vide, et le cas thème sans message dans ce périmètre → score à `0` (thème non omis, cf. `theme-ranking.ts`)
- [x] 1.5 Implémenter `getThemeRiskScoreTrend(runId, filters)` : calcule `getThemeRiskScores` pour les filtres courants et, si `previousPeriodFilters(filters)` retourne une fenêtre valide, pour cette période précédente ; fusionne les deux résultats par `themeId` en un delta signé (`score courant - score précédent`), `null` si la période précédente n'est pas calculable
- [x] 1.6 Écrire `theme-risk-score.test.ts` couvrant : score calculé correctement, thème sans message → 0, message classé sur un seul axe (thème OU sentiment) exclu du calcul, absence totale de données → tableau vide, delta positif/négatif/nul, delta `null` sans filtre de période complet, delta affiché même quand le score précédent est 0

## 2. Composant dashboard (`src/app/dashboard/theme-risk-score-card.tsx`)

- [x] 2.1 Créer `ThemeRiskScoreCard` affichant une liste triée par score décroissant : libellé du thème, score (avec info-bulle/texte reprenant la formule en clair), et badge de tendance quand disponible
- [x] 2.2 Badge de tendance : sens inversé par rapport à `NetScoreComparisonBadge` (hausse du score = dégradation en rouge/Error, baisse = amélioration en vert/Success, égalité = stable), en respectant la palette CSS existante (`globals.css`, pas de nouvelle couleur)
- [x] 2.3 État vide explicite quand la liste est vide (aucun message classé sur les deux axes pour ce scope), cohérent avec les autres cartes (`empty-state`)
- [x] 2.4 Message explicite (pas de badge trompeur) quand la tendance n'est pas calculable faute de période complète, réutilisant le style `net-score-comparison--hint` existant
- [x] 2.5 Réutiliser les classes CSS déjà existantes (`.card`, `.kicker`, `.bar-list`/`.bar-row` ou équivalent) plutôt que d'introduire de nouveaux styles, sauf besoin explicite pour le badge de tendance (auquel cas ajouter les classes nécessaires dans `globals.css` en suivant la palette imposée)

## 3. Intégration dashboard

- [x] 3.1 Brancher `getThemeRiskScores`/`getThemeRiskScoreTrend` dans `page.tsx` (`Promise.all` avec les autres KPIs), en passant `filters` et `previousFilters` déjà calculés pour `net-sentiment-temporal-comparison`
- [x] 3.2 Insérer `ThemeRiskScoreCard` dans `page.tsx`, à proximité de `TopThemesCard` (regroupement logique des KPIs par thème)

## 4. Specs et validation

- [x] 4.1 Lancer `openspec validate add-theme-risk-score-trend --strict` et corriger tout écart de format
- [x] 4.2 Lancer la suite de tests (`npm test` ou équivalent dans `insight-hub-web`) et vérifier que les tests existants (`theme-ranking`, `net-sentiment-score`, `dashboard-filters`) passent toujours sans régression
- [x] 4.3 Tester le dashboard avec Playwright : classement affiché, tendance visible avec une période filtrée, tendance masquée/expliquée sans période, filtre thème actif n'affecte pas ce widget, rendu responsive
