## Why

Le sentiment est déjà recalculé par l'IA pour chaque message (`sentiment_status`), et chaque message porte déjà sa plateforme et son pays d'origine (import CSV). Ces deux KPIs MVP du PRD — Sentiment Score net + évolution, et répartition par plateforme/pays — ne nécessitent aucun nouveau calcul IA : ce sont des agrégations sur des données déjà en base. Le PRD (section 4) les place tous deux au rang MVP, avec l'export PDF basique et la vue "santé de la marque" ; ce changement fournit la première page dashboard réelle du produit et les deux premiers KPIs affichés dessus.

## What Changes

- Nouvelle capacité **Sentiment Score net** : calcul, à partir des messages ayant `sentiment_status = 'completed'`, du score net quotidien = (nb positifs − nb négatifs) / nb total classés ce jour-là, restitué en série temporelle (une valeur par jour, à la granularité du jour comme défini au PRD 1.5) plus la valeur agrégée sur toute la période disponible.
- Nouvelle capacité **Répartition des messages par plateforme et par pays** : calcul, à partir de tous les messages importés, du nombre de messages (et de leur part) par plateforme et par pays, sans dépendre du sentiment.
- Nouvelle **page dashboard** (`/dashboard`), premier écran du genre dans l'app : affiche le Sentiment Score net courant avec sa courbe d'évolution dans le temps, et deux répartitions visuelles (par plateforme, par pays), en lecture seule sur les données déjà calculées.
- Les deux KPIs sont **scopés par défaut au dernier import** (le run d'import le plus récent ayant effectivement des messages associés), plutôt qu'à l'ensemble des messages accumulés toutes sessions confondues — aucune donnée n'est supprimée, seul l'affichage par défaut du dashboard est filtré.
- Nouvelle **navigation simple** entre `/import` et `/dashboard` (barre en haut de chaque page), l'app ayant maintenant deux écrans.
- **Provisoire, désormais résolu** : le temps que la classification IA soit activée, le score net et son évolution utilisaient temporairement `sentiment_original` (l'émotion brute du CSV) mappée vers 3 catégories simples, avec un bandeau d'avertissement sur le dashboard. La classification IA (Gemini, voir `switch-sentiment-classification-to-gemini`) est maintenant active et se déclenche automatiquement après chaque import ; `NET_SENTIMENT_SOURCE` est repassé à `"ai"`, le bandeau provisoire ne s'affiche plus. Le mode `sentiment_original` reste dans le code (basculable via ce même flag) en secours si l'IA redevenait indisponible.
- La page dashboard est rendue en **lecture toujours fraîche** (`export const dynamic = "force-dynamic"`) : comme le sentiment se calcule désormais automatiquement en tâche de fond après import, la page ne doit jamais servir un rendu mis en cache qui daterait d'avant cette classification.
- Aucun nouveau calcul IA, aucune nouvelle colonne de données persistée : uniquement de la lecture/agrégation SQL et de la restitution visuelle.

## Capabilities

### New Capabilities
- `net-sentiment-score`: calcul et restitution (API + visualisation) du score de sentiment net et de son évolution journalière, à partir des sentiments déjà recalculés par l'IA — aucun nouveau calcul IA.
- `platform-country-distribution`: calcul et restitution (API + visualisation) de la répartition du volume de messages par plateforme et par pays.

### Modified Capabilities
(aucune — pas de changement de comportement des specs existantes)

## Impact

- `insight-hub-web/src/db/` : nouveaux modules de requête (miroir de `theme-ranking.ts`) pour le score net + série temporelle, pour la répartition plateforme/pays, pour l'identification du dernier run d'import, et pour le mapping temporaire `sentiment_original` → 3 catégories.
- `insight-hub-web/src/app/dashboard/` : nouvelle page (Server Component, lecture directe via ces modules) et composants de visualisation (courbe d'évolution, graphiques de répartition), premier écran dashboard de l'app.
- `insight-hub-web/src/app/layout.tsx` : nouvelle barre de navigation partagée entre `/import` et `/dashboard`.
- Aucun changement de schéma Drizzle, aucun changement côté `insight-hub-pipeline`.
