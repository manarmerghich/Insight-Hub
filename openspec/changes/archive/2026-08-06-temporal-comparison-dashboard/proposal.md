## Why

Le PRD impose qu'un insight actionnable comporte toujours un chiffre **et** une comparaison (§1.6), et liste explicitement la « comparaison temporelle (période vs période précédente) » comme fonctionnalité V1 du dashboard (§2.D, §4). Aujourd'hui, le score de sentiment net affiché sur le dashboard (`net-sentiment-score`) n'est restitué qu'en valeur absolue pour la période filtrée : l'utilisateur ne peut pas savoir si la perception de la marque s'améliore ou se dégrade sans comparer mentalement deux consultations du dashboard. Ce changement ajoute cette comparaison directement à côté du chiffre existant, en pure restitution (aucun nouveau calcul IA, aucune nouvelle agrégation indépendante des données déjà classées).

## What Changes

- Ajout d'un badge de comparaison à côté du score de sentiment net affiché sur le dashboard, indiquant l'écart (delta en points) entre la période actuellement filtrée et la période précédente équivalente (même durée, immédiatement avant).
- La « période précédente équivalente » est dérivée du filtre de période actif (`dateFrom`/`dateTo` — voir `dashboard-cross-filters`) : même nombre de jours, se terminant la veille du début de la période courante.
- Le calcul de la période précédente réutilise la même formule, le même scope (dernier run d'import) et les mêmes autres filtres croisés actifs (plateforme, pays, sentiment, thème) que le score net courant — seule la fenêtre de dates change.
- Quand aucun filtre de période explicite n'est actif, la comparaison est masquée et remplacée par un message invitant l'utilisateur à sélectionner une période, plutôt que de tenter un calcul qui retournerait systématiquement une absence de donnée (le scope du dashboard étant limité au dernier run d'import, rien n'existe avant la borne de début du run).
- Quand la période précédente équivalente n'a aucun message classé (ex. début de l'historique du run), le badge affiche un état « comparaison indisponible » explicite plutôt qu'un delta trompeur.
- Aucune modification du calcul du score net lui-même, ni des autres KPIs, ni des filtres croisés existants : la fonctionnalité consomme les fonctions de calcul déjà existantes (`getNetSentimentScore`) avec un second jeu de filtres dérivé.

## Capabilities

### New Capabilities
- `net-sentiment-temporal-comparison` : restitue, sur le dashboard, l'écart entre le score de sentiment net de la période filtrée et celui de la période précédente équivalente (même durée), sans aucun nouveau calcul IA ni nouvelle agrégation — uniquement une seconde lecture du calcul déjà existant sur une fenêtre de dates décalée.

### Modified Capabilities
_Aucune_ — le calcul du score net (`net-sentiment-score`) et les filtres croisés (`dashboard-cross-filters`) restent inchangés dans leur comportement ; cette fonctionnalité les consomme sans en modifier les Requirements.

## Impact

- **Code affecté** : `insight-hub-web/src/db/net-sentiment-score.ts` (nouvelle fonction utilitaire de calcul de la fenêtre précédente + appel de `getNetSentimentScore` avec cette fenêtre), `insight-hub-web/src/app/dashboard/page.tsx` (orchestration de l'appel supplémentaire), `insight-hub-web/src/app/dashboard/net-sentiment-card.tsx` (nouveau badge delta), `insight-hub-web/src/app/globals.css` (styles du badge, réutilisant les tokens `--color-success`/`--color-error` existants).
- **Aucun impact** sur le schéma de base de données, les endpoints du pipeline Python, ou l'authentification inter-services.
- **Aucune nouvelle dépendance** : réutilise les composants et fonctions de calcul déjà en place.
