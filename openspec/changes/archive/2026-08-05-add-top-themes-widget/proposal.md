## Why

Le classement des thèmes par volume de messages existe déjà côté données (`getThemeRanking`) et en API (`/api/themes/ranking`), mais n'est restitué nulle part sur le dashboard : le responsable marketing/communication ne peut pas voir aujourd'hui quels thèmes dominent la conversation. De plus, cette restitution existante ignore le dernier run d'import et les filtres croisés déjà en place sur le dashboard, alors que tous les autres KPIs (score net, répartition plateforme/pays, taux d'engagement, score pondéré) respectent déjà ce scope. Ce changement ajoute la carte "Top thèmes" sur le dashboard et aligne son calcul sur les mêmes règles de scope que les autres KPIs, sans déclencher de nouveau calcul IA (restitution uniquement).

## What Changes

- Ajouter sur la page dashboard une carte "Top thèmes" listant les thèmes du référentiel triés par nombre décroissant de messages classés (`theme_status = 'completed'`), avec leur part parmi les messages classés.
- Scoper ce classement au dernier run d'import (comme les autres KPIs du dashboard), au lieu du calcul actuel sur l'ensemble des messages tous runs confondus.
- Appliquer à ce classement les filtres croisés période, plateforme, pays et sentiment déjà présents sur le dashboard. Le filtre croisé par thème ne s'applique pas à ce widget : sélectionner un thème ailleurs sur le dashboard ne réduit pas ce classement à ce seul thème (cela le viderait de son intérêt, puisqu'il sert justement à comparer les thèmes entre eux).
- **BREAKING** : retirer la route API `GET /api/themes/ranking`, qui n'est consommée par aucun client, au profit du même pattern que les autres cartes du dashboard (accès direct aux données depuis le composant serveur de la page).
- Réécrire `getThemeRanking` pour qu'elle accepte le run d'import et les filtres croisés (hors dimension thème), à l'image des modules `db/*.ts` des autres KPIs.

## Capabilities

### New Capabilities

(aucune — ce changement étend des capacités existantes)

### Modified Capabilities

- `top-themes-restitution` : la restitution du classement des thèmes n'est plus « API uniquement, sans page dashboard » ; elle devient une carte visible sur le dashboard, scopée au dernier run d'import, et prend en compte les filtres croisés période/plateforme/pays/sentiment.
- `dashboard-cross-filters` : la liste des KPIs restreints par les filtres croisés s'étend au nouveau classement des thèmes, avec une exception explicite — la dimension thème du filtre croisé n'affecte pas ce KPI en particulier.

## Impact

- `insight-hub-web/src/db/theme-ranking.ts` : signature de `getThemeRanking` modifiée pour accepter `runId` et `DashboardFilters` (hors `themeId`), et appliquer `dashboardFilterConditions`.
- `insight-hub-web/src/app/api/themes/ranking/route.ts` : supprimé.
- `insight-hub-web/src/app/dashboard/page.tsx` : ajout de l'appel à `getThemeRanking(runId, filters)` dans le `Promise.all` existant, et rendu de la nouvelle carte.
- `insight-hub-web/src/app/dashboard/top-themes-card.tsx` : nouveau composant de présentation (liste triée, libellé + nombre + part).
- `openspec/specs/top-themes-restitution/spec.md` et `openspec/specs/dashboard-cross-filters/spec.md` : mis à jour via des delta specs.
- Aucune migration de schéma, aucun nouvel appel IA.
