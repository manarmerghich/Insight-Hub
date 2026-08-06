## Context

Le dashboard restitue déjà des KPIs agrégés par thème (`top-themes-restitution` : volume par thème) et par sentiment (`engagement-rate-by-sentiment` : engagement moyen par sentiment), tous deux calculés sur les classifications déjà en base (`messages.theme_id`/`theme_status`, `messages.sentiment`/`sentiment_status`), sans nouveau calcul IA. Ce pattern de restitution pure est déjà éprouvé côté requêtes (`src/db/theme-ranking.ts`, `src/db/engagement-rate.ts`, `src/db/weighted-sentiment-score.ts`) et côté UI (`top-themes-card.tsx`, `engagement-rate-card.tsx`), tous branchés dans `src/app/dashboard/page.tsx` via `Promise.all` et scopés au dernier run d'import + `DashboardFilters`.

Un précédent directement analogue existe déjà : `sentiment-timeline-peak-detection` (Requirement: Representative Message Per Peak) sélectionne, pour chaque jour de pic, le message de la catégorie de sentiment dominante ayant la plus grande somme `likes + retweets` (null traité comme 0), avec égalité départagée par l'identifiant de message le plus petit. Ce changement généralise ce même mécanisme de sélection à l'axe thème × sentiment, sur l'ensemble des messages classés du scope courant plutôt que sur un seul jour.

## Goals / Non-Goals

**Goals:**
- Pour chaque thème du référentiel et chaque catégorie de sentiment (positif/négatif/neutre), restituer le message classé le plus engageant du scope courant (dernier run d'import + filtres croisés actifs).
- Réutiliser exactement la même source de sentiment que les autres KPIs (`sentiment`/`sentiment_status` en mode IA, mapping `sentiment_original` en mode provisoire — voir `net-sentiment-score`).
- Réutiliser exactement le même critère d'engagement et de départage d'égalité que `sentiment-timeline-peak-detection` (`likes + retweets`, null → 0, égalité → id le plus petit), pour rester cohérent avec un mécanisme déjà validé plutôt que d'en introduire un troisième (l'engagement pondéré `1 + likes + retweets` de `engagement-weighted-sentiment-score` sert à un calcul de score, pas à sélectionner un message représentatif — pattern différent, non retenu ici).
- S'intégrer normalement aux cinq dimensions de filtre croisé (période, plateforme, pays, sentiment, thème), sans l'exception réservée au classement des thèmes.

**Non-Goals:**
- Aucun nouveau calcul IA, aucune nouvelle classification de sentiment ou de thème.
- Pas de pagination ni de recherche libre sur ce widget : un seul message par combinaison, au plus (thèmes du référentiel) × 3.
- Pas de nouvelle notion d'engagement pondéré ni de nouvelle formule — réutilisation stricte de l'existant.

## Decisions

### Sélection du message représentatif : `likes + retweets`, égalité → id le plus petit
Réutilise le même calcul que `sentiment-timeline-peak-detection` (Requirement: Representative Message Per Peak) plutôt que le poids `1 + likes + retweets` de `engagement-weighted-sentiment-score`. Rationale : ce dernier sert à pondérer une moyenne agrégée (le "+1" évite qu'un message sans engagement pèse zéro dans une somme), pas à départager un classement de messages individuels ; le premier existe déjà précisément pour cet usage (choisir *le* message le plus engageant d'une catégorie). Deux formules différentes pour le même concept ("message le plus engageant") créeraient une incohérence visible si un utilisateur croise ce widget avec les pics de la timeline.

### Combinaisons sans message classé : cellule vide, thème toujours listé
Le référentiel de thèmes reste la structure d'affichage fixe (comme `top-themes-restitution`) : chaque thème apparaît, avec pour chacune des 3 catégories de sentiment soit le message représentatif, soit un état vide explicite ("Aucun message classé"). Alternative écartée : omettre entièrement la combinaison sans message (pattern de `engagement-rate-by-sentiment`) — inadapté ici car la structure d'affichage est un thème × 3 colonnes fixes, pas une liste dynamique de catégories ; faire disparaître une colonne casserait la grille pour les autres thèmes.

### Filtres croisés : pas d'exception thème
Contrairement à `top-themes-restitution` (qui doit rester une vue de référence sur tous les thèmes même filtré par thème), ce widget est structurellement organisé par thème : un filtre thème actif le restreint naturellement au thème sélectionné (masquant les autres lignes), ce qui est le comportement attendu et cohérent avec les 4 autres dimensions de filtre. Documenté explicitement dans la spec pour éviter toute confusion avec l'exception de `dashboard-cross-filters`.

### Requête : une passe par thème × sentiment via fenêtrage SQL
Implémentation en une seule requête utilisant `ROW_NUMBER() OVER (PARTITION BY theme_id, sentiment_category ORDER BY (coalesce(likes,0) + coalesce(retweets,0)) DESC, id ASC)` puis filtre `rn = 1`, plutôt que N requêtes (une par combinaison). Le calcul de `sentiment_category` (IA ou provisoire) est isolé dans une fonction/CTE partagée avec `engagement-rate.ts` pour éviter la duplication de la logique de mapping provisoire déjà écrite pour `net-sentiment-score`/`engagement-rate-by-sentiment`.

### UI : grille thème (lignes) × sentiment (colonnes)
Un nouveau composant `RepresentativeMessagesCard` affiche un tableau/grille : une ligne par thème du référentiel, une colonne par catégorie de sentiment (Positif/Négatif/Neutre), chaque cellule affichant soit un mini message-card (texte tronqué, auteur, plateforme, date, `likes`/`retweets`, `FavoriteButton` réutilisé) soit l'état vide. Cohérent avec le style `card`/`bar-list` existant ; pas de nouvelle bibliothèque UI.

## Risks / Trade-offs

- [Grille dense si le référentiel compte de nombreux thèmes] → le référentiel de thèmes est volontairement borné à 5-8 entrées par le PRD ; la grille reste petite (max ~24 cellules). Pas de pagination nécessaire.
- [Incohérence perçue si un autre KPI introduit un jour un 3ᵉ critère d'engagement] → documenté ici explicitement comme réutilisation du critère de `sentiment-timeline-peak-detection`, pour que toute future modification de ce critère mette à jour les deux capacités ensemble.
- [Coût de la requête à fenêtrage sur une base volumineuse] → filtrage par `run_id` et par filtres croisés appliqué avant le `PARTITION BY`, comme pour les autres KPIs ; volume attendu (un run d'import) reste modeste.

## Open Questions

Aucune — les décisions ci-dessus couvrent les ambiguïtés identifiées ; à réviser si le référentiel de thèmes dépasse significativement 8 entrées.
