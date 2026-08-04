## ADDED Requirements

### Requirement: Default Scope To Latest Import Run
Le système SHALL restreindre, par défaut, les données utilisées par ce KPI aux messages du dernier run d'import ayant effectivement des messages associés (et non à l'ensemble des messages accumulés toutes sessions d'import confondues). Un run n'ayant retenu aucun message (doublons, aucune correspondance) est ignoré au profit du run précédent ayant des messages.

#### Scenario: Plusieurs runs d'import existent
- **WHEN** le taux d'engagement par sentiment est demandé et que plusieurs runs d'import ont eu lieu
- **THEN** seuls les messages du run ayant l'identifiant le plus élevé parmi ceux possédant au moins un message sont pris en compte

#### Scenario: Aucun run d'import n'a encore de message
- **WHEN** le taux d'engagement par sentiment est demandé mais qu'aucun run d'import n'a de message associé
- **THEN** le système se comporte comme s'il n'y avait aucun message classé (résultat vide pour chaque catégorie)

### Requirement: Same Sentiment Source As Net Score
Le système SHALL catégoriser les messages pour ce KPI selon la même source de sentiment que le score de sentiment net (`net-sentiment-score`), qu'il s'agisse de la classification IA (`sentiment`/`sentiment_status`) ou, en mode provisoire, du mapping de `sentiment_original`, sans jamais recalculer une catégorisation indépendante.

#### Scenario: Classification IA active
- **WHEN** la classification IA est la source active pour le score net (voir `net-sentiment-score`)
- **THEN** ce KPI catégorise chaque message selon `sentiment` pour les messages ayant `sentiment_status = 'completed'`, en excluant les autres

#### Scenario: Mode provisoire actif
- **WHEN** le mode provisoire est actif (voir `net-sentiment-score`: Provisional Source While AI Classification Is Inactive)
- **THEN** ce KPI catégorise chaque message selon le mapping de `sentiment_original`, avec les mêmes règles de non-reconnaissance et d'absence que celles définies pour le score net

### Requirement: Average Likes And Retweets Per Sentiment Category
Le système SHALL calculer, pour chaque catégorie de sentiment (positif/négatif/neutre) présente parmi les messages classés du dernier run d'import (voir Requirement: Default Scope To Latest Import Run), la moyenne des likes et la moyenne des retweets par message de cette catégorie, en traitant une valeur nulle de likes ou de retweets comme 0, en tenant compte en plus des filtres croisés actifs (période, plateforme, pays, sentiment, thème — voir `dashboard-cross-filters`) le cas échéant.

#### Scenario: Catégorie avec des messages classés
- **WHEN** le taux d'engagement par sentiment est demandé et qu'au moins un message classé appartient à une catégorie de sentiment donnée
- **THEN** le système retourne, pour cette catégorie, la moyenne des likes et la moyenne des retweets calculées sur les messages classés de cette catégorie

#### Scenario: Message avec likes ou retweets non renseignés
- **WHEN** un message classé n'a pas de valeur de likes ou de retweets (champ nul)
- **THEN** ce message est inclus dans le calcul de la moyenne de sa catégorie avec une valeur de 0 pour le champ manquant, plutôt que d'être exclu du calcul

#### Scenario: Taux d'engagement demandé avec des filtres croisés actifs
- **WHEN** le taux d'engagement par sentiment est demandé alors qu'un ou plusieurs filtres croisés sont actifs
- **THEN** le système ne calcule les moyennes qu'à partir des messages du dernier run d'import satisfaisant l'ensemble des filtres actifs

### Requirement: Sentiment Category Without Classified Messages
Le système SHALL omettre de la restitution toute catégorie de sentiment ne comportant aucun message classé sous le scope et les filtres actifs, plutôt que d'afficher une moyenne à zéro trompeuse.

#### Scenario: Catégorie sans message classé
- **WHEN** une catégorie de sentiment n'a aucun message classé sous le scope et les filtres actifs
- **THEN** cette catégorie n'apparaît pas dans le résultat du taux d'engagement par sentiment

### Requirement: Dashboard Engagement Rate Visualization
Le système SHALL afficher, sur la page dashboard, le taux d'engagement par sentiment sous forme d'une visualisation présentant, pour chaque catégorie de sentiment restituée, la moyenne des likes et la moyenne des retweets.

#### Scenario: Dashboard avec messages classés
- **WHEN** l'utilisateur consulte la page dashboard et qu'au moins une catégorie de sentiment a des messages classés
- **THEN** la page affiche, pour chaque catégorie restituée, la moyenne des likes et la moyenne des retweets

#### Scenario: Dashboard sans message classé
- **WHEN** l'utilisateur consulte la page dashboard et qu'aucun message n'est encore classé sous le scope actif
- **THEN** la page affiche un état vide explicite pour ce KPI, sans erreur ni chiffre trompeur
