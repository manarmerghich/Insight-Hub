## ADDED Requirements

### Requirement: Word Frequency Extraction Per Sentiment Category
Le système SHALL extraire, pour chaque catégorie de sentiment (positif/négatif/neutre) présente parmi les messages classés du dernier run d'import (mêmes règles de scope et de source de sentiment que `engagement-rate-by-sentiment`), les mots les plus fréquents du champ texte de ces messages, en excluant les tokens de moins de 3 caractères, les tokens entièrement numériques et une liste de mots vides courants, sans déclencher de nouveau calcul IA ni introduire de nouvelle colonne stockée en base.

#### Scenario: Mots fréquents extraits pour une catégorie
- **WHEN** le nuage de mots par sentiment est demandé et qu'au moins un message classé appartient à une catégorie de sentiment donnée
- **THEN** le système retourne, pour cette catégorie, les mots distincts extraits du texte de ces messages avec leur nombre d'occurrences, triés du plus fréquent au moins fréquent, jusqu'à un maximum de mots par catégorie

#### Scenario: Mot vide ou trop court exclu
- **WHEN** un token extrait du texte d'un message a moins de 3 caractères, est entièrement numérique, ou fait partie de la liste de mots vides courants
- **THEN** ce token n'est comptabilisé dans aucune catégorie de sentiment

#### Scenario: Égalité de fréquence entre plusieurs mots
- **WHEN** plusieurs mots d'une même catégorie ont le même nombre d'occurrences
- **THEN** ces mots sont départagés par ordre alphabétique croissant dans le résultat retourné

#### Scenario: Catégorie sans message classé ou sans mot retenu
- **WHEN** une catégorie de sentiment n'a aucun message classé sous le scope et les filtres actifs, ou que tous les tokens de ses messages sont exclus par les règles de filtrage
- **THEN** cette catégorie apparaît dans le résultat avec une liste de mots vide, plutôt que d'être omise

### Requirement: Cross Filters Applied To Word Extraction
Le système SHALL restreindre les messages pris en compte pour l'extraction de mots par sentiment aux messages satisfaisant l'ensemble des filtres croisés actifs (période, plateforme, pays, sentiment, thème — voir `dashboard-cross-filters`), en plus du scope du dernier run d'import.

#### Scenario: Nuage de mots demandé avec des filtres croisés actifs
- **WHEN** le nuage de mots par sentiment est demandé alors qu'un ou plusieurs filtres croisés sont actifs
- **THEN** le système ne compte les occurrences de mots qu'à partir des messages du dernier run d'import satisfaisant l'ensemble des filtres actifs

#### Scenario: Filtre sentiment actif restreint les catégories concernées
- **WHEN** le filtre croisé sentiment est actif sur une valeur donnée
- **THEN** seule la catégorie de sentiment correspondante peut retourner des mots ; les autres catégories apparaissent avec une liste de mots vide

### Requirement: Dashboard Word Cloud Visualization
Le système SHALL afficher, sur la page dashboard, un nuage de mots par catégorie de sentiment restituant les mots extraits avec une taille visuelle proportionnelle à leur fréquence relative au sein de leur catégorie.

#### Scenario: Dashboard avec mots extraits
- **WHEN** l'utilisateur consulte la page dashboard et qu'au moins une catégorie de sentiment a des mots extraits
- **THEN** la page affiche, pour chaque catégorie ayant des mots, ces mots avec une taille visuelle croissante selon leur fréquence

#### Scenario: Dashboard sans mot extrait pour une catégorie
- **WHEN** l'utilisateur consulte la page dashboard et qu'une catégorie de sentiment n'a aucun mot extrait sous le scope et les filtres actifs
- **THEN** la page affiche un état vide explicite pour cette catégorie, sans erreur ni nuage trompeur

#### Scenario: Dashboard sans aucun message classé
- **WHEN** l'utilisateur consulte la page dashboard et qu'aucun message n'est encore classé sous le scope actif
- **THEN** la page affiche un état vide explicite pour l'ensemble du widget, sans erreur
