## 1. Calcul de la période précédente équivalente

- [x] 1.1 Ajouter `previousPeriodFilters(filters: DashboardFilters): DashboardFilters | null` dans `insight-hub-web/src/db/dashboard-filters.ts` : retourne `null` si `dateFrom` ou `dateTo` manque/invalide, sinon un `DashboardFilters` avec les mêmes `platform`/`country`/`sentiment`/`themeId` et des `dateFrom`/`dateTo` décalés vers la fenêtre précédente de même durée en jours calendaires (arithmétique en UTC sur les dates `YYYY-MM-DD`, voir design.md §3).
- [x] 1.2 Ajouter les tests Vitest de `previousPeriodFilters` dans `dashboard-filters.test.ts` : `dateFrom`/`dateTo` absents → `null` ; une seule borne présente → `null` ; borne invalide (regex date) → `null` ; période de 1 jour ; période de 7 jours ; conservation des autres dimensions de filtre (`platform`, `country`, `sentiment`, `themeId`) inchangées dans le résultat.

## 2. Restitution du score de la période précédente

- [x] 2.1 Dans `insight-hub-web/src/app/dashboard/page.tsx`, calculer `previousFilters = previousPeriodFilters(filters)` puis ajouter au `Promise.all` existant un appel à `getNetSentimentScore(runId, previousFilters)` (garde conditionnelle si `previousFilters` est `null`, sans appel superflu).
- [x] 2.2 Passer `previousScore` et la plage de dates de la période précédente (`previousFilters?.dateFrom`/`dateTo`) en props à `NetSentimentCard`.

## 3. Badge de comparaison dans l'UI

- [x] 3.1 Créer le composant `NetScoreComparisonBadge` dans `insight-hub-web/src/app/dashboard/net-sentiment-card.tsx` (ou fichier dédié si plus lisible), gérant les 4 états définis dans design.md §5 : pas de filtre de période actif, score courant indisponible (badge non affiché), score précédent indisponible (message explicite avec plage de dates), delta positif/négatif/nul (flèche + couleur + libellé de la période précédente).
- [x] 3.2 Intégrer `NetScoreComparisonBadge` dans `NetSentimentCard`, à côté de `NetScoreValue`.
- [x] 3.3 Ajouter les styles du badge dans `insight-hub-web/src/app/globals.css`, en réutilisant les tokens existants (`--color-success`, `--color-error`, variantes de fond teinté clair conformes au contraste WCAG AA déjà en place pour `kpi-value--positive`/`--negative`).
- [x] 3.4 Formater la plage de dates de la période précédente en français (`Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" })` ou équivalent court, cohérent avec `formatDate` déjà utilisé dans `page.tsx`).

## 4. Vérification

- [x] 4.1 Lancer la suite Vitest existante (`npm run test` ou équivalent dans `insight-hub-web`) et vérifier que les nouveaux tests passent sans régression sur les tests de filtres existants.
- [x] 4.2 Tester manuellement avec Playwright sur le dashboard : sans filtre de période (badge masqué + invitation), avec une période récente ayant des données avant (delta positif, négatif, nul), avec une période proche du début de l'historique du run (message « comparaison indisponible »). Vérifier le rendu responsive et l'accessibilité des couleurs (contraste AA) sur les trois états colorés.
- [x] 4.3 Vérifier que `openspec validate temporal-comparison-dashboard --strict` passe avant archivage.
