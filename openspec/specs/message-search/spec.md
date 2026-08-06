# message-search Specification

## Purpose
Permettre une recherche plein texte sur le texte des messages du dernier run d'import depuis le dashboard, sans déclencher de nouveau calcul IA. La recherche se combine en ET avec les filtres croisés existants, trie les résultats par pertinence décroissante en les plafonnant à 50 avec une notice de dépassement, persiste le terme de recherche dans l'URL au même titre que les filtres croisés, et reste scopée au seul dernier run d'import.

## Requirements

### Requirement: Full Text Search On Latest Run Messages
Le système SHALL proposer, sur la page dashboard, une recherche plein texte portant sur le texte des messages du dernier run d'import, sans déclencher de nouveau calcul IA.

#### Scenario: Recherche avec correspondances
- **WHEN** l'utilisateur saisit un terme de recherche présent dans le texte d'au moins un message du dernier run d'import
- **THEN** la page affiche la liste des messages correspondants sans recalculer ni modifier le sentiment, le thème ou tout autre KPI déjà affiché

#### Scenario: Recherche sans correspondance
- **WHEN** l'utilisateur saisit un terme de recherche ne correspondant à aucun message du dernier run d'import
- **THEN** la page affiche un état vide dédié à la recherche, sans erreur

#### Scenario: Aucune recherche active
- **WHEN** l'utilisateur consulte le dashboard sans avoir saisi de terme de recherche et sans avoir activé le filtre favoris uniquement
- **THEN** aucune liste de messages individuels ne s'affiche

### Requirement: Search Combinable With Cross Filters
Le système SHALL restreindre les résultats de la recherche plein texte aux seuls messages satisfaisant également l'ensemble des filtres croisés actifs (période, plateforme, pays, sentiment, thème), en combinaison ET.

#### Scenario: Recherche avec un filtre croisé actif
- **WHEN** l'utilisateur saisit un terme de recherche alors qu'un filtre croisé (ex. une plateforme) est déjà actif
- **THEN** la liste de résultats ne contient que les messages du dernier run d'import qui correspondent à la fois au terme recherché et au filtre actif

#### Scenario: Changement de filtre pendant une recherche active
- **WHEN** l'utilisateur modifie un filtre croisé alors qu'une recherche est déjà saisie
- **THEN** la liste de résultats se met à jour pour refléter la nouvelle combinaison de la recherche et des filtres actifs

### Requirement: Result Ranking And Cap
Le système SHALL trier les résultats de recherche par pertinence décroissante, et SHALL plafonner le nombre de messages affichés à 50, en informant l'utilisateur lorsque le nombre total de correspondances dépasse ce plafond.

#### Scenario: Plus de 50 correspondances
- **WHEN** une recherche retourne plus de 50 messages correspondants dans le dernier run d'import
- **THEN** la page affiche les 50 messages les plus pertinents et un message invitant à affiner la recherche

#### Scenario: 50 correspondances ou moins
- **WHEN** une recherche retourne 50 messages correspondants ou moins
- **THEN** la page affiche l'ensemble des messages correspondants sans message d'invitation à affiner

### Requirement: Search State Persisted In URL
Le système SHALL représenter le terme de recherche courant dans les paramètres de l'URL de la page dashboard, au même titre que les filtres croisés existants.

#### Scenario: Partage ou rechargement d'une URL avec recherche
- **WHEN** l'utilisateur partage ou recharge une URL du dashboard contenant un terme de recherche
- **THEN** la page affiche les résultats de recherche correspondants sans action supplémentaire de l'utilisateur

### Requirement: Search Scoped To Latest Import Run
Le système SHALL restreindre la recherche plein texte aux seuls messages du dernier run d'import, à l'exclusion des runs précédents.

#### Scenario: Plusieurs runs d'import existants
- **WHEN** l'utilisateur effectue une recherche alors que la base contient des messages issus de runs d'import antérieurs au dernier
- **THEN** seuls les messages du dernier run d'import peuvent apparaître dans les résultats de recherche
