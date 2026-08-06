## Why

Le PRD prévoit un export PDF enrichi (résumé IA + favoris + graphiques clés) comme livrable final de la synthèse pour le responsable marketing/communication, qui a besoin d'un document à partager ou archiver au-delà de la consultation à l'écran. Toutes les briques dont cet export dépend (résumé exécutif IA, favoris, score de sentiment net, répartitions par plateforme/pays) sont déjà en place sur le dashboard ; il ne manque que la mise en forme PDF elle-même, prévue dans l'architecture via `@react-pdf/renderer` mais jamais construite. Aucun export PDF basique n'existe non plus à ce jour : ce changement livre directement la version enrichie, qui couvre le même besoin en plus complet.

## What Changes

- Ajout d'un bouton "Exporter en PDF" sur le dashboard, qui déclenche le téléchargement d'un document PDF reflétant le scope actuellement affiché (mêmes filtres croisés actifs : période, plateforme, pays, sentiment, thème).
- Le PDF généré contient :
  - le résumé exécutif IA déjà calculé pour ce scope (texte identique à celui affiché sur le dashboard, aucune régénération) ;
  - le score de sentiment net (valeur + évolution journalière représentée sous forme de graphique) ;
  - les répartitions par plateforme et par pays (graphiques de répartition) ;
  - la liste des messages marqués favoris dans le scope actuel (texte, auteur, plateforme, sentiment).
- Génération côté serveur (route Next.js dédiée) via `@react-pdf/renderer`, sans navigateur headless.
- Nouvelle dépendance npm `@react-pdf/renderer` dans `insight-hub-web`.

## Capabilities

### New Capabilities
- `pdf-export`: génération et téléchargement d'un rapport PDF enrichi (résumé exécutif IA, messages favoris, score de sentiment net avec évolution, répartitions par plateforme et par pays) reflétant le scope de filtres actif du dashboard.

### Modified Capabilities
(aucune — cette capacité consomme en lecture des données déjà exposées par `ai-executive-summary`, `message-favorites`, `net-sentiment-score` et `platform-country-distribution`, sans changer leurs exigences.)

## Impact

- **Code** : nouveau code dans `insight-hub-web` uniquement (aucun changement pipeline) :
  - une route serveur de génération PDF (ex. `app/api/export-pdf/route.ts`) ;
  - des composants `@react-pdf/renderer` (Document/Page/View/Text/Svg) dédiés au rendu PDF, distincts des composants dashboard existants (`net-sentiment-card.tsx`, `distribution-card.tsx`, etc. restent inchangés — leur rendu HTML/SVG n'est pas réutilisable tel quel dans react-pdf) ;
  - un bouton/lien d'export sur `dashboard/page.tsx`, propageant les `searchParams` actifs vers la route PDF.
- **Dépendances** : ajout de `@react-pdf/renderer` (`insight-hub-web/package.json`).
- **Données** : lecture seule des tables/fonctions `db/` existantes (`executive-summary.ts`, `message-search.ts` avec `favoritesOnly`, `net-sentiment-score.ts`, `message-distribution.ts`) ; aucune nouvelle table, aucune migration.
- **Pas d'impact pipeline** : aucun appel IA supplémentaire, le PDF ne fait que restituer des KPIs déjà calculés.
