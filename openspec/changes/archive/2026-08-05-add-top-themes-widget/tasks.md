## 1. Filtre partagé

- [x] 1.1 Dans `insight-hub-web/src/db/dashboard-filters.ts`, ajouter un paramètre optionnel `options?: { includeTheme?: boolean }` (défaut `true`) à `dashboardFilterConditions`, qui omet `themeCondition(filters)` de la liste retournée quand `includeTheme` est `false`.
- [x] 1.2 Vérifier que tous les appels existants de `dashboardFilterConditions` (net-sentiment-score, message-distribution, engagement-rate, weighted-sentiment-score) continuent de compiler sans modification (paramètre optionnel, comportement par défaut inchangé).

## 2. Couche données

- [x] 2.1 Dans `insight-hub-web/src/db/theme-ranking.ts`, changer la signature de `getThemeRanking` en `getThemeRanking(runId: number | null, filters: DashboardFilters): Promise<ThemeRankingEntry[]>`, retournant `[]` immédiatement si `runId` est `null`.
- [x] 2.2 Déplacer les conditions de run et de filtres croisés (période/plateforme/pays/sentiment, via `dashboardFilterConditions(filters, "ai", { includeTheme: false })`) dans la clause `ON` du `LEFT JOIN messages`, en plus de la condition `theme_status = 'completed'` déjà présente — ne rien ajouter dans un `WHERE`, pour que les thèmes sans message correspondant restent affichés avec un compte à zéro.
- [x] 2.3 Vérifier que le total utilisé pour calculer `share` ne compte que les messages du scope filtré (dernier run + filtres actifs hors thème), pas l'ensemble des messages tous runs confondus.

## 3. Interface dashboard

- [x] 3.1 Créer `insight-hub-web/src/app/dashboard/top-themes-card.tsx`, composant de présentation recevant `entries: ThemeRankingEntry[]`, affichant une liste triée (libellé, nombre de messages, part en %), avec un état vide (`empty-state`) si la liste est vide — sur le modèle de `EngagementRateCard`.
- [x] 3.2 Dans `insight-hub-web/src/app/dashboard/page.tsx`, ajouter `getThemeRanking(runId, filters)` au `Promise.all` existant et rendre `<TopThemesCard entries={themeRanking} />` après `<WeightedSentimentCard>`.
- [x] 3.3 Appliquer les styles de carte existants (`globals.css`) sans introduire de nouvelle classe redondante avec `engagement-rate-list`/`engagement-rate-row` si réutilisable tel quel.

## 4. Retrait de l'API orpheline

- [x] 4.1 Supprimer `insight-hub-web/src/app/api/themes/ranking/route.ts`.
- [x] 4.2 Rechercher d'éventuelles références restantes à cette route ou à l'ancienne signature de `getThemeRanking` dans `insight-hub-web` et `insight-hub-pipeline`, et les nettoyer.

## 5. Vérification

- [x] 5.1 Lancer le dashboard en local, vérifier que la carte "Top thèmes" affiche le classement attendu pour le dernier run d'import.
- [x] 5.2 Vérifier manuellement que les filtres période/plateforme/pays/sentiment modifient bien les comptes de la carte, et qu'un filtre thème actif n'affecte PAS la carte (tous les thèmes restent affichés).
- [x] 5.3 Vérifier qu'un thème sans message dans le scope filtré apparaît avec un compte de zéro plutôt que d'être absent.
- [x] 5.4 Tester avec Playwright que la page dashboard reste responsive et fonctionnelle avec la nouvelle carte (desktop et mobile).
- [x] 5.5 Exécuter `openspec validate add-top-themes-widget --strict` et corriger toute erreur de validation.
