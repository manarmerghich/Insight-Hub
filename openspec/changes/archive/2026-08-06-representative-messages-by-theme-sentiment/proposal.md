## Why

Les KPIs du dashboard donnent des chiffres agrégés par thème (`top-themes-restitution`) et par sentiment (`engagement-rate-by-sentiment`), mais aucun ne montre à quoi ressemble concrètement un message pour une combinaison thème × sentiment donnée. Un insight actionnable exige toujours un exemple concret cité (voir PRD) : un responsable marketing qui repère par exemple que le thème "Livraison" a beaucoup de messages négatifs a besoin de lire le message le plus engageant de cette combinaison pour comprendre le grief réel, sans avoir à fouiller la recherche plein texte au hasard.

## What Changes

- Nouveau widget dashboard "Messages représentatifs" : pour chaque thème du référentiel et chaque catégorie de sentiment (positif/négatif/neutre), restitue le message le plus engageant (`likes + retweets` le plus élevé, valeur nulle traitée comme 0, égalité départagée par l'identifiant de message le plus petit) parmi les messages déjà classés du dernier run d'import, respectant les filtres croisés actifs.
- Aucune combinaison thème × sentiment sans message classé n'affiche de message fictif : elle est restituée avec un état vide explicite pour cette cellule, sans faire disparaître le thème du référentiel de l'affichage.
- Réutilisation intégrale des classifications thème/sentiment déjà en base (`theme_id`/`theme_status`, `sentiment`/`sentiment_status`, ou le mapping provisoire de `sentiment_original` selon le mode actif défini par `net-sentiment-score`) : aucun nouvel appel IA, aucune nouvelle agrégation indépendante des données déjà classées.
- Le nouveau widget rejoint la liste des KPIs restreints par les filtres croisés (période, plateforme, pays, sentiment, thème) — sans l'exception qui existe pour le classement des thèmes par volume (`dashboard-cross-filters`, Requirement: Theme Filter Dimension Excluded From Theme Ranking) : ici, un filtre thème restreint normalement l'affichage au thème sélectionné.

## Capabilities

### New Capabilities
- `representative-messages-by-theme-sentiment`: restitution, par thème du référentiel et par catégorie de sentiment, du message le plus engageant déjà classé sous le scope du dernier run d'import et des filtres croisés actifs.

### Modified Capabilities
- `dashboard-cross-filters`: la liste énumérée des KPIs restreints par les filtres croisés (Requirement: Combined Filtering Applied To Existing KPIs) est complétée avec ce nouveau widget, qui suit la règle générale des cinq dimensions sans l'exception réservée au classement des thèmes.

## Impact

- Base de données : aucune migration — lecture seule sur `messages` (`theme_id`, `theme_status`, `sentiment`, `sentiment_status`, `sentiment_original`, `likes`, `retweets`, `timestamp`, `is_favorite`, `text`, `user`, `platform`) et `themes` (référentiel des thèmes).
- `insight-hub-web` : nouvelle fonction de requête `src/db/representative-messages.ts` (ou équivalent) suivant le pattern de `src/db/theme-ranking.ts` / `src/db/engagement-rate.ts` ; nouveau composant `src/app/dashboard/representative-messages-card.tsx` réutilisant le rendu de message existant (`FavoriteButton`, libellés de sentiment) ; branchement dans `src/app/dashboard/page.tsx`.
- Aucun impact sur `insight-hub-pipeline` : pas de nouveau calcul IA.
