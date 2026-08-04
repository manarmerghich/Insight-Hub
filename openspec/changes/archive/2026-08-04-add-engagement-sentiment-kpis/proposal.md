## Why

Le dashboard restitue déjà un score de sentiment net à comptage égal (chaque message positif/négatif compte pour 1) et des répartitions par plateforme/pays, mais aucun KPI ne relie le sentiment au volume d'engagement (likes, retweets) déjà présent dans les messages importés. Un thème peut être massivement négatif tout en étant peu partagé, ou au contraire peu fréquent mais très relayé — sans ces deux KPIs, le responsable marketing/communication ne peut pas distinguer ces deux situations ni évaluer si le sentiment mesuré reflète l'exposition réelle de la marque. Le PRD liste ces deux indicateurs en V1 ; ils sont maintenant à construire.

## What Changes

- Ajout du KPI **Taux d'engagement par sentiment** : pour chaque catégorie de sentiment (positif/négatif/neutre), moyenne des likes et moyenne des retweets par message de cette catégorie, affichées séparément.
- Ajout du KPI **Sentiment pondéré par engagement** : score net recalculé en pondérant chaque message par son poids d'engagement (`1 + likes + retweets`, le plancher à 1 évitant qu'un message sans engagement soit ignoré ou qu'un ensemble de messages tous sans engagement produise un score indéfini) plutôt qu'un comptage à égalité.
- Les deux KPIs respectent le scope existant (dernier run d'import, messages avec sentiment classé) et les filtres croisés déjà en place (période, plateforme, pays, sentiment, thème).
- Aucun nouveau calcul IA : les deux KPIs sont une restitution/agrégation sur des champs déjà présents (`likes`, `retweets`, `sentiment`, `sentiment_status`).
- Ajout de deux nouvelles cartes sur la page dashboard existante, à la suite des cartes déjà affichées.

## Capabilities

### New Capabilities
- `engagement-rate-by-sentiment` : calcule et restitue, par catégorie de sentiment, la moyenne des likes et la moyenne des retweets par message.
- `engagement-weighted-sentiment-score` : calcule et restitue un score de sentiment net pondéré par le poids d'engagement de chaque message, en alternative au score net à comptage égal déjà existant.

### Modified Capabilities
- `dashboard-cross-filters` : l'énumération des KPIs affectés par les filtres croisés doit inclure les deux nouveaux KPIs (Taux d'engagement par sentiment, Sentiment pondéré par engagement), qui doivent réagir aux filtres au même titre que les KPIs déjà couverts.

## Impact

- **Code** : nouveaux modules de requêtes dans `insight-hub-web/src/db/` (agrégations Drizzle sur `messages.likes`/`messages.retweets`/`messages.sentiment`), nouveaux composants de carte dans `insight-hub-web/src/app/dashboard/`, câblage dans `insight-hub-web/src/app/dashboard/page.tsx`.
- **Données** : aucune migration de schéma nécessaire (`likes`, `retweets`, `sentiment`, `sentiment_status` existent déjà sur `messages`).
- **Pipeline Python** : aucun changement (pas de nouveau calcul IA).
- **Specs existantes concernées** : `dashboard-cross-filters` (delta), `net-sentiment-score` (référence, non modifiée — le score pondéré est un KPI distinct, pas un remplacement).
