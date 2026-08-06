## ADDED Requirements

### Requirement: Previous Equivalent Period Derived From Active Period Filter
Le système SHALL calculer, uniquement lorsque les deux bornes `dateFrom` et `dateTo` du filtre de période croisé sont actives et valides (voir `dashboard-cross-filters`), une fenêtre de dates « période précédente équivalente » de même durée en jours calendaires que la période filtrée, se terminant la veille de `dateFrom` et débutant `lengthInDays` jours calendaires avant `dateTo` de la période précédente, sans modifier les autres filtres croisés actifs (plateforme, pays, sentiment, thème).

#### Scenario: Période filtrée de 7 jours
- **WHEN** le filtre de période actif couvre 7 jours calendaires (`dateFrom` au `dateTo`)
- **THEN** la période précédente équivalente calculée couvre également 7 jours calendaires, se terminant la veille de `dateFrom`

#### Scenario: Autres filtres croisés actifs conservés
- **WHEN** un ou plusieurs filtres croisés (plateforme, pays, sentiment, thème) sont actifs en plus du filtre de période
- **THEN** la période précédente équivalente est calculée avec ces mêmes filtres croisés inchangés, seule la fenêtre de dates étant décalée

### Requirement: Comparison Unavailable Without A Complete Period Filter
Le système SHALL ne calculer aucune période précédente, et ne restituer aucune comparaison, lorsque `dateFrom` ou `dateTo` (ou les deux) ne sont pas actifs ou pas valides sur le dashboard.

#### Scenario: Aucun filtre de période actif
- **WHEN** l'utilisateur consulte le dashboard sans avoir défini `dateFrom` ni `dateTo`
- **THEN** aucune période précédente n'est calculée et le dashboard n'affiche pas de comparaison chiffrée pour le score de sentiment net

#### Scenario: Une seule borne de période active
- **WHEN** seul `dateFrom` ou seul `dateTo` est actif (l'autre borne absente ou invalide)
- **THEN** le système traite la période comme incomplète et ne calcule aucune période précédente ni comparaison

### Requirement: Net Sentiment Score Comparison Reuses Existing Calculation
Le système SHALL calculer le score de sentiment net de la période précédente équivalente en appliquant exactement la même méthode de calcul que le score de sentiment net de la période courante (voir `net-sentiment-score`, Requirement: Net Sentiment Score Over Period), sur le même dernier run d'import, sans déclencher aucun nouvel appel IA ni aucune agrégation indépendante des données déjà classées.

#### Scenario: Score précédent calculable
- **WHEN** une période précédente équivalente est calculée et qu'au moins un message du dernier run d'import satisfaisant les filtres croisés actifs (période précédente + autres dimensions) a `sentiment_status = 'completed'`
- **THEN** le système retourne le score net de cette période précédente, calculé avec la même formule que le score net courant

#### Scenario: Aucun message classé sur la période précédente
- **WHEN** une période précédente équivalente est calculée mais qu'aucun message du dernier run d'import ne satisfait à la fois `sentiment_status = 'completed'` et les filtres croisés de cette période précédente
- **THEN** le système retourne une valeur indéfinie pour le score précédent, plutôt qu'un score de zéro

### Requirement: Dashboard Comparison Display
Le système SHALL afficher, à côté du score de sentiment net courant sur le dashboard, l'écart en points entre ce score et le score de la période précédente équivalente lorsque les deux valeurs sont disponibles, sous forme de delta signé accompagné d'une indication visuelle de sens (amélioration, dégradation, ou stabilité) et de la plage de dates de la période précédente utilisée.

#### Scenario: Delta positif
- **WHEN** le score net de la période courante est disponible et strictement supérieur au score net de la période précédente équivalente
- **THEN** le dashboard affiche l'écart positif accompagné d'une indication visuelle d'amélioration et de la plage de dates comparée

#### Scenario: Delta négatif
- **WHEN** le score net de la période courante est disponible et strictement inférieur au score net de la période précédente équivalente
- **THEN** le dashboard affiche l'écart négatif accompagné d'une indication visuelle de dégradation et de la plage de dates comparée

#### Scenario: Delta nul
- **WHEN** le score net de la période courante est disponible et strictement égal au score net de la période précédente équivalente
- **THEN** le dashboard affiche une indication de stabilité, sans indication visuelle d'amélioration ni de dégradation

### Requirement: Comparison Hidden Or Explained When Not Computable
Le système SHALL remplacer l'affichage du delta par un message explicite plutôt que par un chiffre trompeur ou une absence silencieuse d'information, dans chacun des cas où la comparaison ne peut pas être calculée.

#### Scenario: Pas de filtre de période actif
- **WHEN** aucune comparaison n'est calculée faute de filtre de période complet actif (voir Requirement: Comparison Unavailable Without A Complete Period Filter)
- **THEN** le dashboard affiche, à la place du delta, une invitation explicite à sélectionner une période pour activer la comparaison

#### Scenario: Score courant indisponible
- **WHEN** le score de sentiment net de la période courante est lui-même indisponible (aucun message classé pour cette période)
- **THEN** le dashboard n'affiche aucun badge de comparaison, l'état vide déjà affiché pour le score courant suffisant à informer l'utilisateur

#### Scenario: Score précédent indisponible
- **WHEN** un filtre de période complet est actif et que le score courant est disponible, mais que le score de la période précédente équivalente est indéfini (aucun message classé sur cette fenêtre)
- **THEN** le dashboard affiche un message explicite indiquant qu'aucun message classé n'existe sur la période précédente, avec sa plage de dates, plutôt qu'un delta

### Requirement: Comparison Recomputed On Every Visit
Le système SHALL recalculer le score de la période précédente équivalente à la demande à chaque consultation du dashboard, selon la même règle de fraîcheur que le score net courant (voir `net-sentiment-score`, Requirement: Fresh Data On Every Visit), sans jamais servir un résultat de comparaison mis en cache antérieur au dernier calcul.

#### Scenario: Visite après classification de nouveaux messages
- **WHEN** des messages de la fenêtre de période précédente ont été classés après le dernier chargement de la page dashboard
- **THEN** la visite suivante recalcule le score de la période précédente en tenant compte de ces messages, sans action supplémentaire de l'utilisateur
