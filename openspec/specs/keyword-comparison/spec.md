# keyword-comparison Specification

## Purpose
Permettre à l'utilisateur de comparer, côte à côte sur le dashboard, les KPIs déjà calculés du dernier run d'import courant avec ceux du run le plus récent d'un autre mot-clé déjà importé — sans déclencher de nouveau calcul IA ni d'agrégation indépendante, avec un état porté par l'URL pour rester partageable, et sans impacter l'export PDF ni le résumé exécutif.

## Requirements

### Requirement: Comparable Keyword Selection
Le système SHALL proposer, sur le dashboard, un sélecteur listant les mots-clés déjà importés par le visiteur courant (à l'exclusion de tout mot-clé importé par un autre visiteur) ayant au moins un run avec au moins un message, à l'exclusion du mot-clé du dernier run d'import de ce même visiteur (comparaison insensible à la casse).

#### Scenario: Plusieurs mots-clés importés par le même visiteur
- **WHEN** le visiteur courant consulte le dashboard et a déjà importé plusieurs mots-clés distincts sous son identifiant de session
- **THEN** le sélecteur liste chacun de ces mots-clés, à l'exception de celui du dernier run d'import, sans jamais inclure de mot-clé importé par un autre visiteur

#### Scenario: Un seul mot-clé jamais importé par ce visiteur
- **WHEN** le visiteur courant consulte le dashboard et n'a jamais importé, sous son identifiant de session, d'autre mot-clé que celui du dernier run d'import
- **THEN** le sélecteur reste visible mais désactivé, avec un message explicite invitant à importer un second mot-clé pour activer la comparaison, même si d'autres visiteurs ont importé d'autres mots-clés

### Requirement: Latest Run Resolution Per Compared Keyword
Le système SHALL résoudre le mot-clé sélectionné pour comparaison vers son run d'import le plus récent ayant au moins un message associé, à l'exclusion des runs sans message (aucune correspondance ou doublons), de la même manière que la résolution du dernier run d'import global.

#### Scenario: Mot-clé comparé importé plusieurs fois
- **WHEN** un mot-clé sélectionné pour comparaison a été importé lors de plusieurs runs distincts ayant chacun au moins un message
- **THEN** seul le run le plus récent parmi eux est utilisé pour restituer les KPIs comparés

#### Scenario: Mot-clé comparé sans run avec message
- **WHEN** le mot-clé sélectionné pour comparaison (via l'URL) ne correspond à aucun run ayant au moins un message
- **THEN** le système affiche un message explicite indiquant qu'aucun import n'est disponible pour ce mot-clé, plutôt que de masquer silencieusement la comparaison

### Requirement: Side By Side KPI Restitution Without New Computation
Le système SHALL afficher, côte à côte pour le run courant et le run résolu du mot-clé comparé, le score de sentiment net courant, la répartition par plateforme, la répartition par pays et le classement des thèmes, en réutilisant exclusivement les calculs déjà existants pour ces KPIs (voir `net-sentiment-score`, `platform-country-distribution`, `top-themes-restitution`), sans déclencher aucun nouvel appel IA ni aucune agrégation indépendante des données déjà classées.

#### Scenario: Comparaison active avec KPIs disponibles des deux côtés
- **WHEN** un mot-clé comparé est résolu vers un run ayant des messages classés
- **THEN** la page affiche, dans une disposition à deux colonnes, le score net, la répartition plateforme, la répartition pays et le classement des thèmes du run courant et du run comparé, sans courbe d'évolution temporelle

#### Scenario: KPI indéfini d'un côté de la comparaison
- **WHEN** un des deux runs comparés n'a, pour un KPI donné, aucun message satisfaisant les conditions de calcul de ce KPI (ex. aucun message avec un sentiment classé)
- **THEN** ce côté de la comparaison affiche pour ce KPI le même état vide explicite que l'affichage en mode simple de ce KPI, sans afficher de valeur trompeuse ni masquer l'autre côté

### Requirement: Cross Filters Applied Equally To Both Sides
Le système SHALL appliquer, lorsqu'une comparaison est active, les mêmes filtres croisés actifs (période, plateforme, pays, sentiment, thème — voir `dashboard-cross-filters`) aux deux côtés de la comparaison, pour comparer à périmètre égal.

#### Scenario: Filtre croisé actif pendant une comparaison
- **WHEN** un ou plusieurs filtres croisés sont actifs alors qu'une comparaison de mots-clés est affichée
- **THEN** les KPIs affichés pour le run courant et pour le run comparé sont tous deux calculés en tenant compte de ces mêmes filtres

#### Scenario: Changement de filtre pendant une comparaison active
- **WHEN** l'utilisateur modifie un filtre croisé alors qu'une comparaison de mots-clés est déjà affichée
- **THEN** les KPIs des deux côtés de la comparaison se recalculent pour refléter le nouveau filtre, sans perdre le mot-clé comparé sélectionné

### Requirement: Comparison State Persisted In URL
Le système SHALL représenter le mot-clé sélectionné pour comparaison dans les paramètres de l'URL de la page dashboard, au même titre que les filtres croisés et le terme de recherche existants.

#### Scenario: Partage ou rechargement d'une URL avec comparaison active
- **WHEN** l'utilisateur partage ou recharge une URL du dashboard contenant un mot-clé de comparaison
- **THEN** la page affiche la comparaison correspondante sans action supplémentaire de l'utilisateur

#### Scenario: Désactivation de la comparaison
- **WHEN** l'utilisateur désélectionne le mot-clé comparé (option « Aucune comparaison »)
- **THEN** le paramètre de comparaison est retiré de l'URL et la disposition à deux colonnes disparaît, laissant les KPIs du run courant seuls

### Requirement: Comparison Excluded From PDF Export And Executive Summary
Le système SHALL exclure le mot-clé de comparaison de l'export PDF et du résumé exécutif généré par IA, ces deux surfaces restant scopées au seul run courant.

#### Scenario: Export PDF déclenché pendant une comparaison active
- **WHEN** l'utilisateur déclenche l'export PDF alors qu'une comparaison de mots-clés est affichée sur le dashboard
- **THEN** le document généré ne contient que les données du run courant, sans mention du mot-clé comparé

#### Scenario: Résumé exécutif généré pendant une comparaison active
- **WHEN** le résumé exécutif est généré ou affiché alors qu'une comparaison de mots-clés est active
- **THEN** son contenu ne prend en compte que les KPIs du run courant, indépendamment du mot-clé comparé sélectionné
