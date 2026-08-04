## ADDED Requirements

### Requirement: Default Scope To Latest Import Run
Le système SHALL restreindre, par défaut, les données utilisées par ces répartitions aux messages du dernier run d'import ayant effectivement des messages associés (et non à l'ensemble des messages accumulés toutes sessions d'import confondues). Un run n'ayant retenu aucun message (doublons, aucune correspondance) est ignoré au profit du run précédent ayant des messages.

#### Scenario: Plusieurs runs d'import existent
- **WHEN** une répartition (plateforme ou pays) est demandée et que plusieurs runs d'import ont eu lieu
- **THEN** seuls les messages du run ayant l'identifiant le plus élevé parmi ceux possédant au moins un message sont pris en compte

#### Scenario: Aucun run d'import n'a encore de message
- **WHEN** une répartition est demandée mais qu'aucun run d'import n'a de message associé
- **THEN** le système retourne une répartition vide, comme si aucun message n'était importé

### Requirement: Message Distribution By Platform
Le système SHALL restituer, pour chaque plateforme présente dans les messages du dernier run d'import (voir Requirement: Default Scope To Latest Import Run), le nombre de messages et la part qu'il représente parmi ces messages, indépendamment du statut de sentiment ou de thème.

#### Scenario: Répartition par plateforme demandée
- **WHEN** la répartition par plateforme est demandée
- **THEN** le système retourne, pour chaque plateforme distincte présente dans les messages du dernier run d'import, le nombre de messages et sa part du total de ce run, triés du plus grand nombre au plus petit

### Requirement: Message Distribution By Country
Le système SHALL restituer, pour chaque pays présent dans les messages du dernier run d'import, le nombre de messages et la part qu'il représente parmi ces messages, en regroupant sous une catégorie "Non renseigné" les messages sans pays connu.

#### Scenario: Répartition par pays demandée
- **WHEN** la répartition par pays est demandée
- **THEN** le système retourne, pour chaque pays distinct renseigné parmi les messages du dernier run d'import, le nombre de messages et sa part du total de ce run, triés du plus grand nombre au plus petit

#### Scenario: Message sans pays renseigné
- **WHEN** un message du dernier run d'import a un champ pays vide ou absent
- **THEN** ce message est compté dans une catégorie "Non renseigné" plutôt que d'être omis de la répartition

### Requirement: Dashboard Distribution Visualization
Le système SHALL afficher, sur la page dashboard, la répartition des messages par plateforme et par pays sous forme de visualisations distinctes.

#### Scenario: Dashboard avec messages importés
- **WHEN** l'utilisateur consulte la page dashboard et qu'au moins un message est importé
- **THEN** la page affiche une visualisation de la répartition par plateforme et une visualisation de la répartition par pays, chacune triée par volume décroissant

#### Scenario: Dashboard sans message importé
- **WHEN** l'utilisateur consulte la page dashboard et qu'aucun message n'est encore importé
- **THEN** la page affiche un état vide explicite pour ces deux répartitions, sans erreur
