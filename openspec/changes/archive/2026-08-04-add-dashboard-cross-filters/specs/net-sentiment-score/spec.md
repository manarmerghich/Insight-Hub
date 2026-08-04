## MODIFIED Requirements

### Requirement: Net Sentiment Score Over Period
Le système SHALL calculer le score de sentiment net comme (nombre de messages positifs − nombre de messages négatifs) / nombre total de messages ayant `sentiment_status = 'completed'`, sur les messages du dernier run d'import (voir Requirement: Default Scope To Latest Import Run), en tenant compte en plus des filtres croisés actifs (période, plateforme, pays, sentiment, thème — voir `dashboard-cross-filters`) le cas échéant.

#### Scenario: Score net demandé avec des messages classés
- **WHEN** le score net est demandé et qu'au moins un message du dernier run d'import a `sentiment_status = 'completed'`
- **THEN** le système retourne le score net calculé sur ces messages, exprimé en pourcentage entre -100 et 100

#### Scenario: Aucun message classé pour l'instant
- **WHEN** le score net est demandé mais qu'aucun message du dernier run d'import n'a `sentiment_status = 'completed'`
- **THEN** le système retourne une valeur indéfinie (absence de score) plutôt qu'un score de zéro, pour ne pas laisser croire à une neutralité mesurée

#### Scenario: Score net demandé avec des filtres croisés actifs
- **WHEN** le score net est demandé alors qu'un ou plusieurs filtres croisés sont actifs
- **THEN** le système calcule le score net uniquement à partir des messages du dernier run d'import qui satisfont à la fois `sentiment_status = 'completed'` et l'ensemble des filtres actifs

### Requirement: Daily Net Sentiment Evolution
Le système SHALL restituer l'évolution du score net sous forme de série temporelle à la granularité du jour, un point par jour calendaire ayant au moins un message du dernier run d'import avec `sentiment_status = 'completed'`, en tenant compte en plus des filtres croisés actifs (période, plateforme, pays, sentiment, thème — voir `dashboard-cross-filters`) le cas échéant.

#### Scenario: Série demandée sur des jours avec messages classés
- **WHEN** l'évolution du score net est demandée
- **THEN** le système retourne, pour chaque jour calendaire distinct (basé sur `messages.timestamp`) comportant au moins un message du dernier run d'import avec `sentiment_status = 'completed'`, le nombre de messages positifs, négatifs, neutres, le total classé et le score net de ce jour, triés par date croissante

#### Scenario: Jour sans message classé
- **WHEN** un jour calendaire ne comporte aucun message avec `sentiment_status = 'completed'` (que le jour n'ait aucun message importé, ou seulement des messages `pending`/`error`)
- **THEN** ce jour n'apparaît pas dans la série temporelle, plutôt que d'apparaître avec un score à zéro

#### Scenario: Évolution demandée avec des filtres croisés actifs
- **WHEN** l'évolution du score net est demandée alors qu'un ou plusieurs filtres croisés sont actifs, y compris un filtre de période
- **THEN** le système ne retourne que les jours calendaires compris dans la période filtrée (le cas échéant) et ne compte, pour chaque jour retourné, que les messages du dernier run d'import satisfaisant l'ensemble des filtres actifs
