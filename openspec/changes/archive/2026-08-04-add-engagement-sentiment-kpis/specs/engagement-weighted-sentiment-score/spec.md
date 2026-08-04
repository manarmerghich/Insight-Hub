## ADDED Requirements

### Requirement: Default Scope To Latest Import Run
Le système SHALL restreindre, par défaut, les données utilisées par ce KPI aux messages du dernier run d'import ayant effectivement des messages associés (et non à l'ensemble des messages accumulés toutes sessions d'import confondues). Un run n'ayant retenu aucun message (doublons, aucune correspondance) est ignoré au profit du run précédent ayant des messages.

#### Scenario: Plusieurs runs d'import existent
- **WHEN** le score pondéré par engagement est demandé et que plusieurs runs d'import ont eu lieu
- **THEN** seuls les messages du run ayant l'identifiant le plus élevé parmi ceux possédant au moins un message sont pris en compte

#### Scenario: Aucun run d'import n'a encore de message
- **WHEN** le score pondéré par engagement est demandé mais qu'aucun run d'import n'a de message associé
- **THEN** le système se comporte comme s'il n'y avait aucun message classé (score indéfini)

### Requirement: Same Sentiment Source As Net Score
Le système SHALL catégoriser les messages pour ce KPI selon la même source de sentiment que le score de sentiment net (`net-sentiment-score`), qu'il s'agisse de la classification IA (`sentiment`/`sentiment_status`) ou, en mode provisoire, du mapping de `sentiment_original`, sans jamais recalculer une catégorisation indépendante.

#### Scenario: Classification IA active
- **WHEN** la classification IA est la source active pour le score net (voir `net-sentiment-score`)
- **THEN** ce KPI catégorise chaque message selon `sentiment` pour les messages ayant `sentiment_status = 'completed'`, en excluant les autres

#### Scenario: Mode provisoire actif
- **WHEN** le mode provisoire est actif (voir `net-sentiment-score`: Provisional Source While AI Classification Is Inactive)
- **THEN** ce KPI catégorise chaque message selon le mapping de `sentiment_original`, avec les mêmes règles de non-reconnaissance et d'absence que celles définies pour le score net

### Requirement: Message Engagement Weight
Le système SHALL calculer le poids d'engagement d'un message comme `1 + likes + retweets`, en traitant une valeur nulle de likes ou de retweets comme 0, pour tout message pris en compte dans le score pondéré.

#### Scenario: Message avec likes et retweets renseignés
- **WHEN** un message a des valeurs de likes et de retweets renseignées
- **THEN** son poids d'engagement utilisé dans le score pondéré est `1 + likes + retweets`

#### Scenario: Message sans engagement
- **WHEN** un message n'a ni likes ni retweets (valeurs nulles ou à 0)
- **THEN** son poids d'engagement est 1, plutôt que 0, afin qu'il continue de compter dans le score pondéré comme il compterait dans le score net à comptage égal

### Requirement: Engagement-Weighted Net Sentiment Score
Le système SHALL calculer le score de sentiment net pondéré par engagement comme (somme des poids d'engagement des messages positifs − somme des poids d'engagement des messages négatifs) / somme des poids d'engagement de tous les messages classés (positifs, négatifs et neutres), sur les messages du dernier run d'import (voir Requirement: Default Scope To Latest Import Run), en tenant compte en plus des filtres croisés actifs (période, plateforme, pays, sentiment, thème — voir `dashboard-cross-filters`) le cas échéant.

#### Scenario: Score pondéré demandé avec des messages classés
- **WHEN** le score pondéré par engagement est demandé et qu'au moins un message du dernier run d'import est classé
- **THEN** le système retourne le score pondéré calculé sur ces messages, exprimé en points de pourcentage entre -100 et 100

#### Scenario: Aucun message classé pour l'instant
- **WHEN** le score pondéré par engagement est demandé mais qu'aucun message du dernier run d'import n'est classé
- **THEN** le système retourne une valeur indéfinie plutôt qu'un score de zéro, pour ne pas laisser croire à une neutralité mesurée

#### Scenario: Score pondéré demandé avec des filtres croisés actifs
- **WHEN** le score pondéré par engagement est demandé alors qu'un ou plusieurs filtres croisés sont actifs
- **THEN** le système calcule le score pondéré uniquement à partir des messages du dernier run d'import satisfaisant l'ensemble des filtres actifs

### Requirement: Distinct From Equal-Count Net Score
Le système SHALL afficher le score pondéré par engagement comme un KPI distinct du score de sentiment net à comptage égal déjà existant (`net-sentiment-score`), sans remplacer ni modifier ce dernier.

#### Scenario: Les deux scores sont affichés
- **WHEN** l'utilisateur consulte la page dashboard
- **THEN** le score net à comptage égal et le score pondéré par engagement sont tous deux visibles, avec un libellé permettant de les distinguer l'un de l'autre

### Requirement: Dashboard Weighted Sentiment Visualization
Le système SHALL afficher, sur la page dashboard, le score de sentiment net pondéré par engagement courant.

#### Scenario: Dashboard avec données disponibles
- **WHEN** l'utilisateur consulte la page dashboard et qu'un score pondéré est calculable
- **THEN** la page affiche ce score sous forme de chiffre

#### Scenario: Dashboard sans donnée classée
- **WHEN** l'utilisateur consulte la page dashboard et qu'aucun message n'a encore de sentiment classé
- **THEN** la page affiche un état vide explicite pour ce KPI, sans erreur ni chiffre trompeur
