## ADDED Requirements

### Requirement: Same Sentiment Source As Net Score
Le système SHALL catégoriser les messages pour ce widget selon la même source de sentiment que le score de sentiment net (`net-sentiment-score`), qu'il s'agisse de la classification IA (`sentiment`/`sentiment_status`) ou, en mode provisoire, du mapping de `sentiment_original`, sans jamais recalculer une catégorisation indépendante.

#### Scenario: Classification IA active
- **WHEN** la classification IA est la source active pour le score net (voir `net-sentiment-score`)
- **THEN** ce widget catégorise chaque message selon `sentiment` pour les messages ayant `sentiment_status = 'completed'`, en excluant les autres

#### Scenario: Mode provisoire actif
- **WHEN** le mode provisoire est actif (voir `net-sentiment-score`: Provisional Source While AI Classification Is Inactive)
- **THEN** ce widget catégorise chaque message selon le mapping de `sentiment_original`, avec les mêmes règles de non-reconnaissance et d'absence que celles définies pour le score net

### Requirement: Most Engaging Message Per Theme And Sentiment
Le système SHALL restituer, pour chaque thème du référentiel des thèmes et chaque catégorie de sentiment (positif/négatif/neutre), le message ayant `theme_id` correspondant à ce thème avec `theme_status = 'completed'`, appartenant à cette catégorie de sentiment (voir Requirement: Same Sentiment Source As Net Score), et ayant la plus grande somme `likes + retweets` parmi ces messages — une valeur nulle de likes ou de retweets étant traitée comme 0 — scopé au dernier run d'import ayant effectivement des messages associés (un run n'ayant retenu aucun message étant ignoré au profit du run précédent ayant des messages) et restreint par les filtres croisés période, plateforme, pays, sentiment et thème actifs sur le dashboard (voir `dashboard-cross-filters`), sans déclencher de nouveau calcul IA.

#### Scenario: Combinaison avec plusieurs messages classés
- **WHEN** plusieurs messages du scope courant partagent le même thème et la même catégorie de sentiment
- **THEN** le système restitue, pour cette combinaison, le message ayant la plus grande somme likes + retweets parmi eux

#### Scenario: Égalité d'engagement
- **WHEN** plusieurs messages d'une même combinaison thème/sentiment ont la même somme likes + retweets, la plus élevée pour cette combinaison
- **THEN** le système retient de façon déterministe celui ayant l'identifiant le plus petit parmi ces messages à égalité

#### Scenario: Filtres croisés actifs
- **WHEN** le widget est affiché alors qu'un ou plusieurs filtres croisés sont actifs, y compris un filtre sur la dimension thème
- **THEN** le système ne considère, pour chaque combinaison thème/sentiment, que les messages du dernier run d'import satisfaisant l'ensemble des filtres actifs — sans exception pour la dimension thème (contrairement au classement des thèmes par volume, voir `dashboard-cross-filters`: Theme Filter Dimension Excluded From Theme Ranking)

### Requirement: Combination Without Classified Message Shown As Explicit Empty Cell
Le système SHALL restituer, pour une combinaison thème/sentiment sans aucun message classé sous le scope et les filtres actifs, un état vide explicite pour cette combinaison plutôt qu'un message fictif ou l'omission du thème correspondant.

#### Scenario: Thème sans message classé pour une catégorie de sentiment donnée
- **WHEN** un thème du référentiel n'a aucun message classé (theme_status = 'completed') appartenant à une catégorie de sentiment donnée sous le scope et les filtres actifs
- **THEN** cette combinaison thème/sentiment est restituée avec un état vide explicite, tandis que le thème continue d'apparaître pour les autres catégories de sentiment ayant un message classé

#### Scenario: Thème sans aucun message classé
- **WHEN** un thème du référentiel n'a aucun message avec `theme_status = 'completed'` sous le scope et les filtres actifs, quelle que soit la catégorie de sentiment
- **THEN** ce thème apparaît dans la restitution avec un état vide explicite pour chacune de ses trois catégories de sentiment, plutôt que d'être omis

### Requirement: No New AI Computation
Le système SHALL restituer les messages représentatifs uniquement à partir des classifications de thème et de sentiment déjà présentes en base au moment de la consultation, sans déclencher de nouvel appel IA ni de nouvelle agrégation indépendante des données déjà classées.

#### Scenario: Consultation du dashboard
- **WHEN** l'utilisateur consulte le widget des messages représentatifs
- **THEN** aucun appel au service de classification IA (sentiment ou thème) n'est déclenché par cette consultation

### Requirement: Dashboard Representative Messages Visualization
Le système SHALL afficher, sur la page dashboard, une grille présentant chaque thème du référentiel en ligne et chaque catégorie de sentiment en colonne, avec pour chaque cellule le message représentatif restitué (texte, auteur, plateforme, date, likes, retweets, et le contrôle favori existant) ou son état vide explicite.

#### Scenario: Dashboard avec au moins un message classé
- **WHEN** l'utilisateur consulte la page dashboard et qu'au moins une combinaison thème/sentiment a un message classé sous le scope actif
- **THEN** la page affiche la grille avec, pour chaque combinaison ayant un message, son contenu (texte, auteur, plateforme, date, likes, retweets, contrôle favori)

#### Scenario: Dashboard sans aucun message classé
- **WHEN** l'utilisateur consulte la page dashboard et qu'aucun message n'est encore classé (thème et sentiment) sous le scope actif
- **THEN** la page affiche un état vide explicite pour l'ensemble du widget, sans erreur

#### Scenario: Aucun run d'import disponible
- **WHEN** aucun run d'import n'existe encore
- **THEN** le dashboard affiche un état vide pour ce widget, sans erreur

#### Scenario: Marquage favori depuis la grille
- **WHEN** l'utilisateur bascule le contrôle favori d'un message affiché dans une cellule de la grille
- **THEN** le comportement est identique à celui déjà défini pour le marquage favori ailleurs sur le dashboard (voir `message-favorites`), sans logique dupliquée
