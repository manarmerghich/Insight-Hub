# sentiment-timeline-peak-detection Specification

## Purpose
TBD - created by change detect-sentiment-timeline-peaks. Update Purpose after archive.

## Requirements
### Requirement: Peak Day Detection Threshold
Le système SHALL calculer la moyenne et l'écart-type (population) du `netScore` sur l'ensemble des jours de la série d'évolution du score net actuellement restituée (voir `net-sentiment-score`, Requirement: Daily Net Sentiment Evolution), et marquer un jour comme pic positif si son `netScore` dépasse la moyenne de plus de 2 écarts-types, ou comme pic négatif s'il est inférieur à la moyenne de plus de 2 écarts-types.

#### Scenario: Jour dans la plage normale
- **WHEN** l'écart entre le `netScore` d'un jour et la moyenne de la série est inférieur ou égal à 2 écarts-types
- **THEN** ce jour n'est marqué ni comme pic positif ni comme pic négatif

#### Scenario: Jour significativement au-dessus de la moyenne
- **WHEN** le `netScore` d'un jour dépasse la moyenne de la série de plus de 2 écarts-types
- **THEN** ce jour est marqué comme pic positif

#### Scenario: Jour significativement en-dessous de la moyenne
- **WHEN** le `netScore` d'un jour est inférieur à la moyenne de la série de plus de 2 écarts-types
- **THEN** ce jour est marqué comme pic négatif

### Requirement: Minimum Sample Size For Peak Detection
Le système SHALL exiger au moins 5 jours dans la série d'évolution pour tenter une détection de pics ; en dessous de ce seuil, ou si l'écart-type de la série est nul, aucun jour n'est marqué comme pic.

#### Scenario: Série trop courte
- **WHEN** la série d'évolution restituée comporte moins de 5 jours
- **THEN** aucun jour n'est marqué comme pic, quelle que soit la dispersion des valeurs présentes

#### Scenario: Série sans dispersion
- **WHEN** la série comporte au moins 5 jours mais que tous les jours ont exactement le même `netScore` (écart-type nul)
- **THEN** aucun jour n'est marqué comme pic

### Requirement: Peaks Derived From Existing Net Sentiment Series
Le système SHALL calculer les pics uniquement par post-traitement de la série déjà produite par `net-sentiment-score` (même dernier run d'import, mêmes filtres croisés actifs — période, plateforme, pays, sentiment, thème), sans déclencher aucun nouvel appel IA ni aucune nouvelle agrégation indépendante des données déjà classées.

#### Scenario: Filtres croisés actifs
- **WHEN** un ou plusieurs filtres croisés sont actifs sur le dashboard
- **THEN** la moyenne, l'écart-type et les pics sont calculés uniquement sur les jours de la série déjà restreinte par ces filtres, sans requête IA supplémentaire

#### Scenario: Période filtrée
- **WHEN** un filtre de période restreint la série affichée à une fenêtre de jours plus courte
- **THEN** la moyenne et l'écart-type utilisés pour la détection de pics sont recalculés sur cette fenêtre restreinte, pas sur l'historique complet

### Requirement: Representative Message Per Peak
Le système SHALL fournir, pour chaque jour marqué comme pic, un message représentatif de ce jour : le message classé dans la catégorie de sentiment correspondant à la direction du pic (positif pour un pic positif, négatif pour un pic négatif), avec la plus grande somme `likes + retweets` (une valeur nulle de likes ou de retweets étant traitée comme 0) parmi les messages de ce jour et de cette catégorie, scopé au même run d'import et aux mêmes filtres croisés que la série affichée.

#### Scenario: Pic positif avec plusieurs messages positifs ce jour-là
- **WHEN** un jour est marqué comme pic positif et que plusieurs messages positifs de ce jour existent dans le scope courant
- **THEN** le système retourne, comme exemple concret, le message positif ayant la plus grande somme likes + retweets

#### Scenario: Égalité d'engagement
- **WHEN** plusieurs messages de la catégorie dominante d'un jour de pic ont la même somme likes + retweets, la plus élevée
- **THEN** le système retient de façon déterministe celui ayant l'identifiant le plus petit parmi ces messages à égalité

### Requirement: Dashboard Peak Annotation
Le système SHALL afficher, sur la courbe d'évolution du score net déjà présente sur le dashboard, une annotation visuelle distincte pour chaque jour marqué comme pic positif et chaque jour marqué comme pic négatif, permettant à l'utilisateur de consulter pour ce jour le score net, son écart à la moyenne de la période affichée, et le message représentatif associé.

#### Scenario: Dashboard avec au moins un pic détecté
- **WHEN** l'utilisateur consulte la page dashboard et que la série d'évolution contient au moins un jour marqué comme pic
- **THEN** la courbe affiche un marqueur visuellement distinct pour ce jour, différenciant pic positif et pic négatif, et permet de consulter le score du jour, son écart à la moyenne et le message représentatif

#### Scenario: Dashboard sans pic détecté
- **WHEN** l'utilisateur consulte la page dashboard et qu'aucun jour n'est marqué comme pic (série trop courte, écart-type nul, ou aucun jour hors seuil)
- **THEN** la courbe s'affiche normalement, sans marqueur de pic ni erreur

### Requirement: No Active Alerting
Le système SHALL se limiter à une annotation visuelle passive et recalculée à la demande à chaque visite du dashboard, sans déclencher de notification (email, Slack ou autre) et sans persister d'historique des pics détectés.

#### Scenario: Pic détecté lors d'une visite
- **WHEN** un ou plusieurs jours sont marqués comme pic lors du calcul déclenché par une visite du dashboard
- **THEN** aucune notification n'est envoyée et aucune donnée relative à ce pic n'est écrite en base

#### Scenario: Nouvelle visite après arrivée de nouveaux messages classés
- **WHEN** l'utilisateur revisite le dashboard après que de nouveaux messages ont été classés depuis sa dernière visite
- **THEN** les pics affichés sont recalculés à partir de la série d'évolution à jour, sans être servis depuis un résultat mis en cache lors d'une visite précédente
