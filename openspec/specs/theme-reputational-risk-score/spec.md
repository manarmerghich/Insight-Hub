# theme-reputational-risk-score Specification

## Purpose
Calculer et afficher, pour chaque thème du référentiel, un score de risque réputationnel combinant le poids du thème dans le volume total de messages classés et la part de messages négatifs au sein de ce thème, ainsi que sa tendance vs la période précédente équivalente, restreint par les filtres croisés actifs (hors dimension thème) — sans jamais déclencher de nouveau calcul IA et toujours recalculé à la demande.

## Requirements

### Requirement: Theme Reputational Risk Score Calculation
Le système SHALL calculer, pour chaque thème du référentiel, un score de risque réputationnel égal à (part du thème dans le volume total de messages classés) × (part de messages négatifs au sein de ce thème) × 100, en ne comptant que les messages du dernier run d'import ayant à la fois `theme_status = 'completed'` et `sentiment_status = 'completed'`, restreint par les filtres croisés période/plateforme/pays/sentiment actifs (la dimension thème étant ignorée — voir `dashboard-cross-filters`), sans déclencher de nouveau calcul IA.

#### Scenario: Score calculable pour un thème
- **WHEN** le score de risque réputationnel est demandé et qu'au moins un message du dernier run d'import a `theme_id` égal à ce thème avec `theme_status = 'completed'` et `sentiment_status = 'completed'`
- **THEN** le système retourne un score entre 0 et 100 égal à (nombre de messages classés de ce thème / nombre total de messages classés tous thèmes confondus) × (nombre de messages négatifs de ce thème / nombre de messages classés de ce thème) × 100

#### Scenario: Thème sans message classé pour ce scope
- **WHEN** un thème du référentiel n'a aucun message satisfaisant à la fois `theme_status = 'completed'` et `sentiment_status = 'completed'` pour le scope courant
- **THEN** ce thème apparaît avec un score de risque égal à zéro, plutôt que d'être omis ou indéfini

#### Scenario: Aucun message classé pour aucun thème
- **WHEN** aucun message du dernier run d'import ne satisfait à la fois `theme_status = 'completed'` et `sentiment_status = 'completed'`, pour aucun thème
- **THEN** le système retourne une liste vide pour ce KPI, sans erreur

#### Scenario: Message classé pour un seul des deux axes
- **WHEN** un message a `theme_status = 'completed'` mais `sentiment_status` égal à `'pending'` ou `'error'` (ou inversement)
- **THEN** ce message n'est compté ni dans le nombre de messages classés du thème, ni dans le total tous thèmes confondus, pour ce calcul

### Requirement: Theme Risk Score Trend Vs Previous Equivalent Period
Le système SHALL calculer, pour chaque thème, l'écart signé entre son score de risque réputationnel de la période filtrée courante et son score de risque réputationnel de la période précédente équivalente (voir `net-sentiment-temporal-comparison`, Requirement: Previous Equivalent Period Derived From Active Period Filter), en appliquant exactement la même méthode de calcul de score aux deux périodes, uniquement lorsque `dateFrom` et `dateTo` sont tous deux actifs et valides sur le dashboard.

#### Scenario: Tendance calculable
- **WHEN** un filtre de période complet est actif et que la période précédente équivalente peut être dérivée
- **THEN** le système retourne, pour chaque thème, l'écart signé entre le score de risque de la période courante et celui de la période précédente équivalente

#### Scenario: Aucun filtre de période actif
- **WHEN** l'utilisateur consulte le dashboard sans `dateFrom` ni `dateTo` actifs
- **THEN** aucune tendance par thème n'est calculée ni affichée

#### Scenario: Une seule borne de période active
- **WHEN** seul `dateFrom` ou seul `dateTo` est actif
- **THEN** le système traite la période comme incomplète et ne calcule aucune tendance par thème

#### Scenario: Thème absent de la période précédente
- **WHEN** un thème a un score de risque de zéro sur la période précédente équivalente (aucun message classé pour ce thème sur cette fenêtre) mais un score non nul sur la période courante
- **THEN** le système affiche tout de même l'écart signé, le score zéro de la période précédente étant une valeur significative et non une absence de mesure

### Requirement: Dashboard Theme Risk Ranking Display
Le système SHALL afficher, sur la page dashboard, le classement des thèmes par score de risque réputationnel décroissant, chaque ligne indiquant le libellé du thème, son score courant et, lorsqu'elle est calculable, sa tendance vs la période précédente équivalente avec une indication visuelle de sens (dégradation pour une hausse du risque, amélioration pour une baisse, stabilité pour un écart nul).

#### Scenario: Dashboard avec scores disponibles
- **WHEN** l'utilisateur consulte la page dashboard et qu'au moins un thème a un score de risque calculable
- **THEN** la page affiche le classement des thèmes triés du score de risque le plus élevé au plus faible, avec pour chacun son score et sa tendance si disponible

#### Scenario: Tendance indisponible pour un thème affiché
- **WHEN** la tendance n'est pas calculable (filtre de période incomplet ou absent)
- **THEN** le classement affiche tout de même les scores courants de chaque thème, sans colonne de tendance ni chiffre trompeur à la place

#### Scenario: Dashboard sans aucune donnée classée
- **WHEN** aucun thème n'a de score de risque calculable (aucun message classé sur les deux axes pour ce scope)
- **THEN** la page affiche un état vide explicite pour ce widget, sans erreur

#### Scenario: Hausse du risque affichée comme une dégradation
- **WHEN** le score de risque d'un thème sur la période courante est strictement supérieur à celui de la période précédente équivalente
- **THEN** le dashboard affiche l'écart positif accompagné d'une indication visuelle de dégradation (et non d'amélioration, contrairement au sens utilisé pour le score de sentiment net)

#### Scenario: Baisse du risque affichée comme une amélioration
- **WHEN** le score de risque d'un thème sur la période courante est strictement inférieur à celui de la période précédente équivalente
- **THEN** le dashboard affiche l'écart négatif accompagné d'une indication visuelle d'amélioration

### Requirement: Fresh Data On Every Visit
Le système SHALL toujours calculer le score de risque réputationnel par thème et sa tendance à la demande, sans jamais servir un rendu de page mis en cache antérieur au dernier calcul.

#### Scenario: Visite après classification de nouveaux messages
- **WHEN** des messages ont été classés en thème et/ou en sentiment après le dernier chargement de la page dashboard
- **THEN** la visite suivante recalcule le score de risque et sa tendance en tenant compte de ces messages, sans action supplémentaire de l'utilisateur
