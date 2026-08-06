## Why

Le PRD prévoit la comparaison à deux mots-clés (« simulation concurrentielle ») comme cas d'usage du dashboard, mais rien ne permet aujourd'hui de comparer les KPIs d'un mot-clé importé à un autre : chaque consultation du dashboard reste scopée au seul dernier run d'import. Un responsable marketing/communication qui a importé plusieurs mots-clés (sa marque et un concurrent, par exemple) n'a aucun moyen de les mettre côte à côte sans changer manuellement de contexte.

## What Changes

- Ajout d'un sélecteur sur le dashboard permettant de choisir un second mot-clé parmi ceux déjà importés (autre que celui du run courant), pour activer une vue de comparaison.
- Le mot-clé comparé résout automatiquement vers son run d'import le plus récent ayant des messages associés (même règle que « Default Scope To Latest Import Run », appliquée par mot-clé plutôt que globalement).
- Affichage côte à côte, pour le run courant et le run comparé : score de sentiment net courant, répartition par plateforme, répartition par pays, classement des thèmes — tous déjà calculés, aucune courbe d'évolution temporelle ni nouveau calcul IA.
- Les filtres croisés actifs du dashboard (période, plateforme, pays, sentiment, thème) s'appliquent identiquement aux deux côtés de la comparaison, pour comparer à périmètre égal.
- Le mot-clé comparé est représenté dans les paramètres d'URL du dashboard, au même titre que les filtres croisés et la recherche, pour rester partageable/rechargeable.
- Restitution uniquement : la comparaison réutilise les fonctions de lecture existantes (score net, répartitions, classement des thèmes) avec le `runId` résolu pour le second mot-clé ; aucun appel IA, aucune agrégation indépendante des données déjà classées.

## Capabilities

### New Capabilities
- `keyword-comparison`: sélection d'un second mot-clé déjà importé et restitution côte à côte de ses KPIs principaux (score de sentiment net, répartitions plateforme/pays, classement des thèmes) avec le run courant, à filtres croisés égaux, sans nouveau calcul.

### Modified Capabilities
(aucune — les capacités existantes de calcul des KPIs, ex. `net-sentiment-score`, `platform-country-distribution`, `top-themes-restitution`, sont réutilisées telles quelles via leur paramètre `runId` déjà présent, sans changement de leurs requirements)

## Impact

- `insight-hub-web/src/db/` : nouvelle fonction de résolution « dernier run par mot-clé » (liste des mots-clés disponibles + résolution du run pour un mot-clé donné), analogue à `latest-import-run.ts` mais paramétrée par mot-clé.
- `insight-hub-web/src/db/dashboard-filters.ts` : ajout du paramètre de mot-clé comparé au parsing des filtres d'URL (`parseDashboardFilters` / `SearchParams`).
- `insight-hub-web/src/app/dashboard/page.tsx` : résolution du second `runId` et appels supplémentaires (en lecture seule) aux fonctions KPI existantes avec ce `runId`.
- `insight-hub-web/src/app/dashboard/` : nouveau composant de sélection du mot-clé comparé et nouveau composant d'affichage côte à côte des KPIs comparés.
- Aucune migration de schéma, aucune nouvelle route API, aucun nouvel appel au pipeline Python.
