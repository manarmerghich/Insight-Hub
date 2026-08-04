## MODIFIED Requirements

### Requirement: Message Distribution By Platform
Le système SHALL restituer, pour chaque plateforme présente dans les messages du dernier run d'import (voir Requirement: Default Scope To Latest Import Run), le nombre de messages et la part qu'il représente parmi ces messages, indépendamment du statut de sentiment ou de thème, en tenant compte en plus des filtres croisés actifs (période, plateforme, pays, sentiment, thème — voir `dashboard-cross-filters`) le cas échéant.

#### Scenario: Répartition par plateforme demandée
- **WHEN** la répartition par plateforme est demandée
- **THEN** le système retourne, pour chaque plateforme distincte présente dans les messages du dernier run d'import, le nombre de messages et sa part du total de ce run, triés du plus grand nombre au plus petit

#### Scenario: Répartition par plateforme demandée avec des filtres croisés actifs
- **WHEN** la répartition par plateforme est demandée alors qu'un ou plusieurs filtres croisés sont actifs (autres que le filtre plateforme lui-même)
- **THEN** le système ne compte que les messages du dernier run d'import satisfaisant l'ensemble de ces filtres, avant de les répartir par plateforme

### Requirement: Message Distribution By Country
Le système SHALL restituer, pour chaque pays présent dans les messages du dernier run d'import, le nombre de messages et la part qu'il représente parmi ces messages, en regroupant sous une catégorie "Non renseigné" les messages sans pays connu, en tenant compte en plus des filtres croisés actifs (période, plateforme, pays, sentiment, thème — voir `dashboard-cross-filters`) le cas échéant.

#### Scenario: Répartition par pays demandée
- **WHEN** la répartition par pays est demandée
- **THEN** le système retourne, pour chaque pays distinct renseigné parmi les messages du dernier run d'import, le nombre de messages et sa part du total de ce run, triés du plus grand nombre au plus petit

#### Scenario: Message sans pays renseigné
- **WHEN** un message du dernier run d'import a un champ pays vide ou absent
- **THEN** ce message est compté dans une catégorie "Non renseigné" plutôt que d'être omis de la répartition

#### Scenario: Répartition par pays demandée avec des filtres croisés actifs
- **WHEN** la répartition par pays est demandée alors qu'un ou plusieurs filtres croisés sont actifs (autres que le filtre pays lui-même)
- **THEN** le système ne compte que les messages du dernier run d'import satisfaisant l'ensemble de ces filtres, avant de les répartir par pays
