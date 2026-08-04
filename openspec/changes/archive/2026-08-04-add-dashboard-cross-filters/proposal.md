## Why

Le dashboard (`sentiment-and-distribution-dashboard`) affiche aujourd'hui le score net de sentiment, son évolution et les répartitions plateforme/pays sur un scope fixe et unique : le dernier import. L'utilisateur ne peut ni isoler une période, ni comparer une plateforme ou un pays en particulier, ni voir comment ces KPIs varient pour un sentiment ou un thème donné — alors que ce sont exactement les questions business du PRD ("Quel thème génère le plus de négatif ?", "Sur quelle plateforme/pays sommes-nous le plus exposés ?"). Les filtres croisés (période, plateforme, pays, sentiment, thème) sont un item MVP explicite du PRD (section 4) et un non-goal assumé du changement précédent, qui prévoyait ce changement comme suite naturelle.

## What Changes

- Ajout d'une barre de filtres sur la page `/dashboard`, avec cinq contrôles indépendants et combinables : période (date de début/fin), plateforme, pays, sentiment, thème.
- Les filtres sélectionnés restreignent (en `AND`) le jeu de messages sous-jacent à **tous** les KPIs déjà affichés sur le dashboard (score net + évolution, répartition plateforme, répartition pays), sans déclencher de nouveau calcul IA — uniquement des clauses SQL supplémentaires sur des colonnes déjà persistées (`timestamp`, `platform`, `country`, `sentiment`, `theme_id`).
- Les filtres s'appliquent **en plus** du scope implicite existant ("dernier import ayant des messages") ; ils ne le remplacent pas.
- État des filtres porté par l'URL (`searchParams`) plutôt qu'un état client, pour rester partageable/bookmarkable et cohérent avec le rendu Server Component déjà en place (`export const dynamic = "force-dynamic"`).
- Valeurs par défaut = aucun filtre actif (comportement identique à aujourd'hui) ; un contrôle de réinitialisation permet de revenir à cet état en un clic.
- Les options de plateforme/pays/thème proposées dans les contrôles sont dérivées des valeurs réellement présentes dans le dernier import (pas une liste statique), pour éviter de proposer des filtres qui ne retourneraient jamais de résultat.

## Capabilities

### New Capabilities
- `dashboard-cross-filters` : la barre de filtres elle-même (contrôles, persistance dans l'URL, combinaison `AND` entre dimensions, interaction avec le scope "dernier import", réinitialisation).

### Modified Capabilities
- `net-sentiment-score` : le score net et son évolution journalière doivent désormais accepter des filtres additionnels (période, plateforme, pays, sentiment, thème) en plus du scope "dernier import" déjà existant.
- `platform-country-distribution` : les répartitions par plateforme et par pays doivent désormais accepter les mêmes filtres additionnels.

## Impact

- `insight-hub-web/src/db/net-sentiment-score.ts` : `getNetSentimentScore` / `getDailyNetSentimentEvolution` gagnent un paramètre de filtres, en plus de `runId`.
- `insight-hub-web/src/db/message-distribution.ts` : `getPlatformDistribution` / `getCountryDistribution` gagnent le même paramètre de filtres.
- Nouveau module `insight-hub-web/src/db/dashboard-filter-options.ts` (ou équivalent) pour lister les valeurs de plateforme/pays/thème disponibles dans le dernier import.
- `insight-hub-web/src/app/dashboard/page.tsx` : lit les filtres depuis `searchParams`, les passe aux fonctions `db/`.
- Nouveau composant Client (barre de filtres) sous `insight-hub-web/src/app/dashboard/`.
- Aucune migration de schéma, aucune nouvelle dépendance npm.
