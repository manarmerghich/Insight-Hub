## Why

Le dashboard restitue déjà le classement des thèmes par volume (`top-themes-restitution`), mais un thème très volumineux et légèrement négatif peut être tout aussi préoccupant qu'un petit thème très négatif, sans qu'aucun KPI ne le fasse ressortir explicitement. Un responsable marketing a besoin d'un chiffre unique combinant volume et intensité négative pour prioriser ses thèmes à risque, ainsi que de savoir si ce risque se dégrade ou s'améliore récemment — sans relancer de calcul IA, uniquement en restituant les sentiments et thèmes déjà classés.

## What Changes

- Ajout d'un score de risque réputationnel par thème : `score = (part du volume classé du thème parmi tous les thèmes) × (part de messages négatifs au sein du thème) × 100`, calculé sur les messages du dernier run d'import ayant à la fois `theme_status = 'completed'` et `sentiment_status = 'completed'`.
- Ajout d'une tendance par thème : écart signé du score de risque entre la période filtrée courante et la période précédente équivalente (même mécanique que `net-sentiment-temporal-comparison`), affiché uniquement quand `dateFrom`/`dateTo` sont actifs et complets.
- Les deux KPIs sont restitués ensemble dans un même widget dashboard (classement des thèmes par score de risque, avec colonne de tendance), sans déclencher de nouveau calcul IA.
- Le filtre croisé thème est ignoré pour ce widget (comme pour `top-themes-restitution`) : sélectionner un thème dans les filtres ne doit pas réduire le classement à une seule ligne.

## Capabilities

### New Capabilities
- `theme-reputational-risk-score` : calcul et restitution du score de risque réputationnel par thème (volume × intensité négative) et de sa tendance vs période précédente équivalente, sur le dashboard.

### Modified Capabilities
- `dashboard-cross-filters` : la liste des KPIs soumis aux filtres croisés combinés s'enrichit du nouveau widget de risque par thème ; l'exception « filtre thème ignoré » (déjà appliquée au classement des thèmes par volume) s'étend à ce nouveau widget.

## Impact

- `insight-hub-web/src/db/` : nouveau module de calcul (ex. `theme-risk-score.ts`), réutilisant `dashboardFilterConditions` (avec `includeTheme: false`) et `previousPeriodFilters` déjà existants.
- `insight-hub-web/src/app/dashboard/` : nouveau composant carte (ex. `theme-risk-score-card.tsx`) et branchement dans `page.tsx`.
- Aucune migration de schéma, aucun nouvel appel IA, aucune nouvelle dépendance.
