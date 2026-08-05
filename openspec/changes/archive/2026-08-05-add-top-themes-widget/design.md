## Context

`getThemeRanking` (`insight-hub-web/src/db/theme-ranking.ts`) et la route `GET /api/themes/ranking` existent depuis le changement `ai-theme-detection`, livrés volontairement en « API seulement, pas de page dashboard ». La fonction fait un `LEFT JOIN themes → messages` filtré sur `theme_status = 'completed'`, sans aucun paramètre : elle ignore le dernier run d'import et les filtres croisés introduits juste après (`dashboard-cross-filters`). Aucun client ne consomme cette route (confirmé par recherche dans le code).

Tous les autres KPIs du dashboard (`net-sentiment-score.ts`, `message-distribution.ts`, `engagement-rate.ts`, `weighted-sentiment-score.ts`) suivent le même pattern : un module `db/*.ts` exportant `get<Metric>(runId: number | null, filters: DashboardFilters)`, appelé depuis `page.tsx` (composant serveur) dans le `Promise.all` existant, qui combine `eq(messages.runId, runId)` et `dashboardFilterConditions(filters, source)` (`dashboard-filters.ts`). Ce changement aligne le classement des thèmes sur ce même pattern.

## Goals / Non-Goals

**Goals:**
- Rendre le classement des thèmes visible sur le dashboard, dans une nouvelle carte.
- Scoper ce classement au dernier run d'import, comme tous les autres KPIs.
- Appliquer les filtres croisés période/plateforme/pays/sentiment à ce classement.
- Conserver le comportement déjà spécifié : thèmes à zéro message affichés (pas omis), messages non `completed` exclus.

**Non-Goals:**
- Aucun nouveau calcul IA (pas de re-détection ni reclassification de thèmes).
- Le filtre croisé par thème ne s'applique pas à ce widget (décision produit confirmée : le classement doit rester comparatif entre tous les thèmes, même quand un thème est sélectionné ailleurs sur le dashboard).
- Pas de pagination ni de « top N » : le référentiel compte 5 à 8 thèmes, la liste complète est affichée.

## Decisions

**Exclure la dimension thème via une option sur `dashboardFilterConditions`, plutôt que dupliquer la logique de filtrage dans `theme-ranking.ts`.**
`dashboardFilterConditions(filters, sentimentSource, options?)` gagne un paramètre optionnel `{ includeTheme?: boolean }` (défaut `true`, comportement inchangé pour tous les widgets existants). `theme-ranking.ts` l'appelle avec `{ includeTheme: false }`. Alternative envisagée : construire à la main dans `theme-ranking.ts` la liste `[dateRangeCondition, platformCondition, countryCondition, sentimentCondition]` sans passer par le helper partagé — rejetée, car cela dupliquerait la logique de combinaison et risquerait de diverger si une dimension de filtre est ajoutée plus tard.

**Les conditions de run et de filtres croisés vont dans la clause `ON` du `LEFT JOIN`, pas dans le `WHERE`.**
La requête reste `SELECT ... FROM themes LEFT JOIN messages ON (messages.themeId = themes.id AND messages.themeStatus = 'completed' AND messages.runId = :runId AND <conditions de filtre>)`. Mettre ces conditions dans un `WHERE` transformerait de facto le `LEFT JOIN` en `INNER JOIN` (un thème sans message correspondant au run/filtres serait éliminé), ce qui casserait le scénario déjà spécifié « thème sans message classé apparaît avec zéro ». C'est le point d'attention principal de ce changement.

**Retirer la route `GET /api/themes/ranking` et faire consommer `getThemeRanking` directement par `page.tsx`.**
Alternative : conserver la route et la faire appeler en interne par la page (fetch serveur vers son propre déploiement). Rejetée : aucun autre widget du dashboard ne passe par une route API, ce détour ajouterait une latence et une dépendance réseau inutiles pour une donnée déjà accessible en direct via Drizzle. La route n'ayant aucun consommateur connu, sa suppression est sans risque fonctionnel (**BREAKING** listé dans la proposition par précaution).

**Nouvelle carte `TopThemesCard`, ajoutée en bas de la grille du dashboard (après `WeightedSentimentCard`), sur le modèle de `EngagementRateCard`.**
Liste triée, une ligne par thème : libellé, nombre de messages, part en pourcentage. État vide (aucun run, ou aucun thème classé) : même traitement que les autres cartes (`empty-state`).

**`getThemeRanking` retourne `[]` si `runId` est `null`.**
Comportement aligné sur les autres `get<Metric>` (ex. `getEngagementRateBySentiment`), différent du comportement actuel qui interrogeait tous les runs même en l'absence de tout import. C'est un changement de comportement intentionnel, cohérent avec le scope run introduit par ce changement.

## Risks / Trade-offs

- [Le classement des thèmes est le seul KPI qui n'applique pas toutes les dimensions de filtre croisé, ce qui peut surprendre] → Mitigation : documenté explicitement comme exception dans la spec `dashboard-cross-filters` modifiée, avec un scénario dédié, plutôt que laissé implicite.
- [Suppression de `/api/themes/ranking` pourrait casser un consommateur externe non détecté par la recherche dans le code] → Mitigation : recherche exhaustive effectuée (aucune référence dans `insight-hub-web` ni `insight-hub-pipeline`) ; changement marqué **BREAKING** dans la proposition pour visibilité.
- [Mettre les conditions de filtre dans le `ON` plutôt que le `WHERE` est un détail d'implémentation facile à rater lors d'une future modification de la requête] → Mitigation : décision documentée ici, et couverte par les scénarios de spec existants (thème à zéro message) qui échoueraient en test si régressés.

## Migration Plan

Pas de migration de données ni de changement de schéma. Déploiement en une seule fois : le changement de signature de `getThemeRanking` et la suppression de la route sont faits dans le même changement, sans période de coexistence nécessaire (aucun appelant externe). Rollback possible par simple revert du commit.
