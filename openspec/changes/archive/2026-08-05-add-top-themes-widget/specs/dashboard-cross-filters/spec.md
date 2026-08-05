## MODIFIED Requirements

### Requirement: Combined Filtering Applied To Existing KPIs
Le système SHALL restreindre, lorsque un ou plusieurs filtres croisés sont actifs, les données de tous les KPIs déjà affichés sur le dashboard (score net et son évolution, répartition par plateforme, répartition par pays, taux d'engagement par sentiment, score de sentiment net pondéré par engagement, classement des thèmes par volume de messages) aux seuls messages respectant l'ensemble des filtres actifs (combinaison en ET), en plus du scope existant du dernier run d'import. Aucun nouveau calcul IA n'est déclenché par l'application d'un filtre.

#### Scenario: Un seul filtre actif
- **WHEN** l'utilisateur sélectionne une seule dimension de filtre (ex. une plateforme)
- **THEN** tous les KPIs affichés sont recalculés à partir des seuls messages du dernier run d'import correspondant à cette plateforme

#### Scenario: Plusieurs filtres actifs simultanément
- **WHEN** l'utilisateur sélectionne plusieurs dimensions de filtre à la fois (ex. une période, un pays et un sentiment)
- **THEN** tous les KPIs affichés sont recalculés à partir des seuls messages du dernier run d'import satisfaisant simultanément l'ensemble de ces filtres

#### Scenario: Combinaison de filtres sans résultat
- **WHEN** la combinaison de filtres actifs ne correspond à aucun message du dernier run d'import
- **THEN** chaque KPI affiche son état vide déjà existant, sans erreur ni message dédié supplémentaire

## ADDED Requirements

### Requirement: Theme Filter Dimension Excluded From Theme Ranking
Le système SHALL ignorer la dimension de filtre croisé thème pour le classement des thèmes par volume de messages : ce KPI reste calculé sur tous les thèmes du référentiel même lorsqu'un thème est sélectionné dans les filtres croisés, tandis que les autres dimensions de filtre (période, plateforme, pays, sentiment) continuent de s'y appliquer normalement.

#### Scenario: Filtre thème actif
- **WHEN** l'utilisateur sélectionne un thème dans les filtres croisés
- **THEN** le classement des thèmes par volume continue d'afficher tous les thèmes du référentiel avec leurs comptes respectifs, sans se restreindre au seul thème sélectionné, tandis que les autres filtres croisés actifs continuent de s'appliquer à ce classement

#### Scenario: Aucun filtre thème actif
- **WHEN** aucun filtre croisé thème n'est sélectionné
- **THEN** le classement des thèmes par volume se comporte normalement, sans différence liée à cette exception
