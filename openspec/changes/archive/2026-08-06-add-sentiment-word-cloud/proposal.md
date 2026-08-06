## Why

Les KPIs du dashboard résument le sentiment par des chiffres agrégés (score net, taux d'engagement, thèmes), mais aucun ne donne une lecture rapide du vocabulaire réellement employé par les auteurs des messages. Un responsable marketing qui repère un sentiment négatif dominant a besoin de voir en un coup d'œil les mots qui reviennent le plus souvent dans les messages négatifs (par opposition aux positifs et neutres) pour comprendre de quoi parlent concrètement les gens, sans lire message par message.

## What Changes

- Nouveau widget dashboard "Nuage de mots par sentiment" : pour chaque catégorie de sentiment (positif/négatif/neutre), restitue les mots les plus fréquents parmi le texte des messages déjà classés du dernier run d'import, respectant les filtres croisés actifs, avec une taille visuelle proportionnelle à la fréquence.
- Extraction de mots pure côté application : tokenisation du champ `text` des messages (minuscules, ponctuation/emojis ignorés, mots de moins de 3 caractères et tokens purement numériques exclus, liste de mots vides anglais courants filtrée), comptage de fréquence par catégorie de sentiment, sans aucun appel IA ni nouvelle colonne stockée en base.
- Réutilisation intégrale de la classification de sentiment déjà en base (`sentiment`/`sentiment_status`, ou le mapping provisoire de `sentiment_original` selon le mode actif défini par `net-sentiment-score`) : aucune nouvelle agrégation IA, uniquement du texte déjà importé.
- Catégorie de sentiment sans message classé (ou dont tous les mots sont filtrés) : nuage vide explicite pour cette catégorie, sans faire disparaître la catégorie de l'affichage.
- Le nouveau widget rejoint la liste des KPIs restreints par les filtres croisés (période, plateforme, pays, sentiment, thème) — sans exception particulière : un filtre sentiment restreint normalement l'affichage aux catégories correspondantes, comme pour `engagement-rate-by-sentiment` et `representative-messages-by-theme-sentiment`.

## Capabilities

### New Capabilities
- `sentiment-word-cloud`: extraction et restitution visuelle, par catégorie de sentiment, des mots les plus fréquents parmi les messages déjà classés sous le scope du dernier run d'import et des filtres croisés actifs, sans nouveau calcul IA.

### Modified Capabilities
- `dashboard-cross-filters`: la liste énumérée des KPIs restreints par les filtres croisés (Requirement: Combined Filtering Applied To Existing KPIs) est complétée avec ce nouveau widget, qui suit la règle générale des cinq dimensions sans exception particulière.

## Impact

- Base de données : aucune migration — lecture seule sur `messages` (`text`, `sentiment`, `sentiment_status`, `sentiment_original`, `run_id`, `theme_id`, `theme_status`, `platform`, `country`, `timestamp`).
- `insight-hub-web` : nouvelle fonction de requête + tokenisation `src/db/sentiment-word-cloud.ts` (ou équivalent) suivant le pattern de `src/db/engagement-rate.ts` (source de sentiment partagée) ; nouveau composant `src/app/dashboard/sentiment-word-cloud-card.tsx` réutilisant le style de carte existant ; branchement dans `src/app/dashboard/page.tsx`.
- Aucun impact sur `insight-hub-pipeline` : pas de nouveau calcul IA, pas de nouvelle colonne ni de nouveau run.
