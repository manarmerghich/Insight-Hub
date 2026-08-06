## MODIFIED Requirements

### Requirement: Dashboard Distribution Visualization
Le système SHALL afficher, sur la page dashboard, la répartition des messages par plateforme sous forme d'une liste triée par volume décroissant, et la répartition par pays sous forme d'une carte du monde interactive accompagnée d'un classement compact trié par volume décroissant.

#### Scenario: Dashboard avec messages importés
- **WHEN** l'utilisateur consulte la page dashboard et qu'au moins un message est importé
- **THEN** la page affiche une liste de répartition par plateforme triée par volume décroissant, ainsi qu'une carte du monde et un classement des pays triés par volume décroissant

#### Scenario: Dashboard sans message importé
- **WHEN** l'utilisateur consulte la page dashboard et qu'aucun message n'est encore importé
- **THEN** la page affiche un état vide explicite pour la répartition par plateforme et pour la répartition par pays (carte et classement), sans erreur

## ADDED Requirements

### Requirement: Country Net Sentiment Score
Le système SHALL calculer, pour chaque pays présent dans les messages du dernier run d'import (voir Requirement: Default Scope To Latest Import Run), un score de sentiment net ((messages positifs − messages négatifs) / messages classés de ce pays), en tenant compte des filtres croisés actifs, avec la même source de sentiment que le score de sentiment net global (voir `net-sentiment-score`). Un pays sans message classé par le sentiment n'a pas de score (valeur indéfinie plutôt qu'un score à zéro).

#### Scenario: Pays avec messages classés
- **WHEN** le score de sentiment net par pays est calculé pour un pays ayant au moins un message avec un sentiment classé
- **THEN** le système retourne un score entre -100 et 100 pour ce pays, calculé sur ses seuls messages classés

#### Scenario: Pays sans message classé
- **WHEN** un pays du dernier run d'import n'a aucun message avec un sentiment classé
- **THEN** le système ne retourne aucun score numérique pour ce pays plutôt qu'un score à zéro

### Requirement: Map Coloring Metric Toggle
Le système SHALL permettre de basculer la coloration de la carte des pays entre le volume de messages et le score de sentiment net par pays, sans recharger la page ni perdre les filtres croisés actifs.

#### Scenario: Bascule vers le sentiment
- **WHEN** l'utilisateur active la coloration par sentiment sur la carte
- **THEN** chaque pays représenté sur la carte est coloré selon son score de sentiment net (voir Requirement: Country Net Sentiment Score) plutôt que selon son volume de messages

#### Scenario: Bascule vers le volume
- **WHEN** l'utilisateur active la coloration par volume sur la carte (comportement par défaut)
- **THEN** chaque pays représenté sur la carte est coloré selon sa part du volume total de messages filtré

### Requirement: Country Code Mapping For Map Rendering
Le système SHALL faire correspondre chaque valeur de pays présente dans les messages à une zone du fond de carte lorsque cette correspondance est reconnue, et SHALL conserver dans le classement, sans erreur, les pays et la catégorie "Non renseigné" pour lesquels aucune zone de carte n'est reconnue.

#### Scenario: Pays reconnu par le fond de carte
- **WHEN** un pays des messages du dernier run d'import correspond à une zone du fond de carte (correspondance exacte ou via une variante connue)
- **THEN** cette zone est colorée sur la carte selon la métrique active (volume ou sentiment)

#### Scenario: Pays non reconnu par le fond de carte
- **WHEN** un pays des messages du dernier run d'import ne correspond à aucune zone du fond de carte, ou lorsqu'il s'agit de la catégorie "Non renseigné"
- **THEN** ce pays apparaît dans le classement sous la carte avec son volume et sa part, sans colorer aucune zone de la carte et sans erreur affichée
