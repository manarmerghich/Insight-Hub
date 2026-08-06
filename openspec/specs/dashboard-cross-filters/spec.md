# dashboard-cross-filters Specification

## Purpose
Permettre à l'utilisateur de restreindre les KPIs déjà affichés sur le dashboard (score net et son évolution, répartition par plateforme, répartition par pays, taux d'engagement par sentiment, score de sentiment net pondéré par engagement, nuage de mots par sentiment) à une combinaison de dimensions (période, plateforme, pays, sentiment, thème), en plus du scope existant du dernier run d'import — sans déclencher de nouveau calcul IA, avec un état porté par l'URL pour rester partageable.

## Requirements

### Requirement: Cross Filter Dimensions
Le système SHALL proposer, sur la page dashboard, cinq dimensions de filtre indépendantes : période (date de début et de fin), plateforme, pays, sentiment, thème.

#### Scenario: Filtres proposés à l'utilisateur
- **WHEN** l'utilisateur consulte la page dashboard
- **THEN** la page affiche cinq contrôles distincts permettant de filtrer par période, plateforme, pays, sentiment et thème

### Requirement: Combined Filtering Applied To Existing KPIs
Le système SHALL restreindre, lorsque un ou plusieurs filtres croisés sont actifs, les données de tous les KPIs déjà affichés sur le dashboard (score net et son évolution, répartition par plateforme, répartition par pays, taux d'engagement par sentiment, score de sentiment net pondéré par engagement, classement des thèmes par volume de messages, messages représentatifs par thème et sentiment, nuage de mots par sentiment) aux seuls messages respectant l'ensemble des filtres actifs (combinaison en ET), en plus du scope existant du dernier run d'import. Aucun nouveau calcul IA n'est déclenché par l'application d'un filtre.

#### Scenario: Un seul filtre actif
- **WHEN** l'utilisateur sélectionne une seule dimension de filtre (ex. une plateforme)
- **THEN** tous les KPIs affichés sont recalculés à partir des seuls messages du dernier run d'import correspondant à cette plateforme

#### Scenario: Plusieurs filtres actifs simultanément
- **WHEN** l'utilisateur sélectionne plusieurs dimensions de filtre à la fois (ex. une période, un pays et un sentiment)
- **THEN** tous les KPIs affichés sont recalculés à partir des seuls messages du dernier run d'import satisfaisant simultanément l'ensemble de ces filtres

#### Scenario: Combinaison de filtres sans résultat
- **WHEN** la combinaison de filtres actifs ne correspond à aucun message du dernier run d'import
- **THEN** chaque KPI affiche son état vide déjà existant, sans erreur ni message dédié supplémentaire

### Requirement: Theme Filter Dimension Excluded From Theme Ranking
Le système SHALL ignorer la dimension de filtre croisé thème pour le classement des thèmes par volume de messages : ce KPI reste calculé sur tous les thèmes du référentiel même lorsqu'un thème est sélectionné dans les filtres croisés, tandis que les autres dimensions de filtre (période, plateforme, pays, sentiment) continuent de s'y appliquer normalement.

#### Scenario: Filtre thème actif
- **WHEN** l'utilisateur sélectionne un thème dans les filtres croisés
- **THEN** le classement des thèmes par volume continue d'afficher tous les thèmes du référentiel avec leurs comptes respectifs, sans se restreindre au seul thème sélectionné, tandis que les autres filtres croisés actifs continuent de s'appliquer à ce classement

#### Scenario: Aucun filtre thème actif
- **WHEN** aucun filtre croisé thème n'est sélectionné
- **THEN** le classement des thèmes par volume se comporte normalement, sans différence liée à cette exception

### Requirement: Filter State Persisted In URL
Le système SHALL représenter l'état courant des filtres croisés dans les paramètres de l'URL de la page dashboard, plutôt que dans un état non partageable.

#### Scenario: Partage ou rechargement de l'URL
- **WHEN** l'utilisateur partage ou recharge une URL du dashboard contenant des paramètres de filtre
- **THEN** la page affiche les KPIs déjà filtrés selon ces paramètres, sans action supplémentaire de l'utilisateur

#### Scenario: Aucun paramètre de filtre dans l'URL
- **WHEN** l'utilisateur consulte `/dashboard` sans aucun paramètre de filtre
- **THEN** la page affiche les KPIs sur le seul scope du dernier run d'import, comme avant l'introduction des filtres croisés

### Requirement: Filter Options Derived From Latest Import
Le système SHALL proposer, pour les dimensions plateforme, pays et thème, uniquement des valeurs réellement présentes parmi les messages du dernier run d'import (et non une liste statique), pour ne jamais proposer un filtre qui ne retournerait aucun résultat pour ce run. Le pays "Non renseigné" est proposé comme option si au moins un message du run n'a pas de pays connu. Le thème n'est proposé que s'il a au moins un message avec `theme_status = 'completed'` dans ce run. Le sentiment propose systématiquement les trois valeurs possibles (positif/négatif/neutre), indépendamment des données présentes.

#### Scenario: Options de plateforme et de pays
- **WHEN** l'utilisateur ouvre le contrôle de filtre plateforme ou pays
- **THEN** seules les plateformes et pays effectivement présents parmi les messages du dernier run d'import sont proposés comme options

#### Scenario: Thème sans message classé dans ce run
- **WHEN** un thème du référentiel n'a aucun message avec `theme_status = 'completed'` dans le dernier run d'import
- **THEN** ce thème n'apparaît pas parmi les options du contrôle de filtre thème

### Requirement: Reset Filters
Le système SHALL permettre de réinitialiser en une seule action l'ensemble des filtres croisés actifs, en revenant à l'état sans aucun filtre.

#### Scenario: Réinitialisation demandée
- **WHEN** l'utilisateur déclenche la réinitialisation des filtres alors qu'au moins un filtre est actif
- **THEN** tous les filtres sont désactivés et les KPIs affichés reviennent au scope du seul dernier run d'import

### Requirement: Permissive Handling Of Invalid Filter Values
Le système SHALL ignorer toute valeur de paramètre de filtre invalide ou non reconnue dans l'URL (plutôt que de produire une erreur), en traitant la dimension concernée comme non filtrée.

#### Scenario: Paramètre d'URL invalide
- **WHEN** l'URL du dashboard contient une valeur de filtre qui ne correspond à aucune valeur reconnue pour sa dimension (ex. un identifiant de thème non numérique)
- **THEN** la page affiche les KPIs comme si ce filtre particulier n'était pas actif, sans erreur affichée à l'utilisateur
