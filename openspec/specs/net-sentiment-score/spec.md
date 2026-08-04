# net-sentiment-score Specification

## Purpose
TBD - created by archiving change sentiment-and-distribution-dashboard. Update Purpose after archive.
## Requirements
### Requirement: Provisional Source While AI Classification Is Inactive
Le système SHALL, tant que l'API Anthropic n'est pas activée (aucun message n'atteint `sentiment_status = 'completed'`), calculer le score net et son évolution à partir de `sentiment_original` (l'émotion brute du CSV) mappée vers 3 catégories simples (positif/négatif/neutre), plutôt que de rester indéfiniment sans donnée. Une émotion non reconnue dans le mapping est classée neutre par défaut, plutôt que d'être devinée arbitrairement. Ce mode est temporaire et documenté comme tel ; les Requirements "Net Sentiment Score Over Period", "Daily Net Sentiment Evolution" et "Unclassified Messages Excluded From Net Score" s'appliquent alors à cette source à la place de `sentiment`/`sentiment_status`, jusqu'à la réactivation officielle décrite dans ces mêmes Requirements.

#### Scenario: Message avec une émotion d'origine reconnue
- **WHEN** le mode provisoire est actif et qu'un message a un `sentiment_original` reconnu comme positif ou négatif dans le mapping
- **THEN** ce message est compté dans la catégorie correspondante pour le calcul du score net et de son évolution

#### Scenario: Message avec une émotion d'origine non reconnue
- **WHEN** le mode provisoire est actif et qu'un message a un `sentiment_original` non présent dans le mapping positif/négatif (ex. émotion thématique ambiguë)
- **THEN** ce message est compté comme neutre plutôt que d'être exclu du calcul

#### Scenario: Message sans émotion d'origine
- **WHEN** le mode provisoire est actif et qu'un message n'a pas de `sentiment_original` (vide ou absent)
- **THEN** ce message est exclu du calcul, comme le serait un message non classé en mode IA

### Requirement: Default Scope To Latest Import Run
Le système SHALL restreindre, par défaut, les données utilisées par ce KPI aux messages du dernier run d'import ayant effectivement des messages associés (et non à l'ensemble des messages accumulés toutes sessions d'import confondues). Un run n'ayant retenu aucun message (doublons, aucune correspondance) est ignoré au profit du run précédent ayant des messages.

#### Scenario: Plusieurs runs d'import existent
- **WHEN** le score net ou son évolution est demandé et que plusieurs runs d'import ont eu lieu
- **THEN** seuls les messages du run ayant l'identifiant le plus élevé parmi ceux possédant au moins un message sont pris en compte

#### Scenario: Aucun run d'import n'a encore de message
- **WHEN** le score net ou son évolution est demandé mais qu'aucun run d'import n'a de message associé
- **THEN** le système se comporte comme s'il n'y avait aucun message classé (score indéfini, série vide)

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

### Requirement: Unclassified Messages Excluded From Net Score
Le système SHALL exclure du calcul du score net et de son évolution tout message dont `sentiment_status` vaut `'pending'` ou `'error'`.

#### Scenario: Messages en attente ou en erreur
- **WHEN** des messages ont `sentiment_status` égal à `'pending'` ou `'error'`
- **THEN** ces messages ne sont comptés ni dans le score net agrégé, ni dans aucun point de la série temporelle d'évolution

### Requirement: Dashboard Net Sentiment Visualization
Le système SHALL afficher, sur la page dashboard, le score de sentiment net courant ainsi qu'une courbe de son évolution dans le temps.

#### Scenario: Dashboard avec données disponibles
- **WHEN** l'utilisateur consulte la page dashboard et qu'un score net est calculable
- **THEN** la page affiche le score net courant sous forme de chiffre, accompagné d'une courbe montrant son évolution jour par jour

#### Scenario: Dashboard sans donnée classée
- **WHEN** l'utilisateur consulte la page dashboard et qu'aucun message n'a encore `sentiment_status = 'completed'`
- **THEN** la page affiche un état vide explicite pour ce KPI, sans erreur ni chiffre trompeur

#### Scenario: Dashboard en mode provisoire
- **WHEN** le score net affiché provient du mode provisoire (Requirement: Provisional Source While AI Classification Is Inactive)
- **THEN** la page affiche un avertissement explicite indiquant que ce score est basé sur le sentiment original du CSV et non sur une classification IA

### Requirement: Fresh Data On Every Visit
Le système SHALL toujours calculer le score net et son évolution à la demande, sans jamais servir un rendu de page mis en cache antérieur au dernier calcul, afin que l'utilisateur voie systématiquement le sentiment déjà classé sans action supplémentaire de sa part.

#### Scenario: Visite après une classification survenue entre deux consultations
- **WHEN** un message a été classé (automatiquement ou manuellement) après le dernier chargement de la page dashboard
- **THEN** la visite suivante de la page reflète ce nouveau sentiment, sans qu'un rechargement forcé, une purge de cache ou toute autre action de l'utilisateur ne soit nécessaire

