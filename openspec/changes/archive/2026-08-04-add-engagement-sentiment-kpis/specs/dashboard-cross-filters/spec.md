## MODIFIED Requirements

### Requirement: Combined Filtering Applied To Existing KPIs
Le système SHALL restreindre, lorsque un ou plusieurs filtres croisés sont actifs, les données de tous les KPIs déjà affichés sur le dashboard (score net et son évolution, répartition par plateforme, répartition par pays, taux d'engagement par sentiment, score de sentiment net pondéré par engagement) aux seuls messages respectant l'ensemble des filtres actifs (combinaison en ET), en plus du scope existant du dernier run d'import. Aucun nouveau calcul IA n'est déclenché par l'application d'un filtre.

#### Scenario: Un seul filtre actif
- **WHEN** l'utilisateur sélectionne une seule dimension de filtre (ex. une plateforme)
- **THEN** tous les KPIs affichés sont recalculés à partir des seuls messages du dernier run d'import correspondant à cette plateforme

#### Scenario: Plusieurs filtres actifs simultanément
- **WHEN** l'utilisateur sélectionne plusieurs dimensions de filtre à la fois (ex. une période, un pays et un sentiment)
- **THEN** tous les KPIs affichés sont recalculés à partir des seuls messages du dernier run d'import satisfaisant simultanément l'ensemble de ces filtres

#### Scenario: Combinaison de filtres sans résultat
- **WHEN** la combinaison de filtres actifs ne correspond à aucun message du dernier run d'import
- **THEN** chaque KPI affiche son état vide déjà existant, sans erreur ni message dédié supplémentaire
