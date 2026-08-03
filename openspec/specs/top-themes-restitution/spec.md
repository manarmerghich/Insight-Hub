# top-themes-restitution

## Purpose

Restituer, en lecture seule, le classement des thèmes déjà calculés par volume de messages (le libellé de thème tient lieu de mot-clé), sans déclencher de nouveau calcul IA. Exposée en API uniquement pour ce changement — pas de nouvelle page dashboard.

## Requirements

### Requirement: Theme Ranking By Volume
Le système SHALL restituer les thèmes du référentiel existant triés par nombre décroissant de messages classés dans chacun, sans déclencher de nouveau calcul IA.

#### Scenario: Classement demandé
- **WHEN** le classement des thèmes est demandé
- **THEN** le système retourne, pour chaque thème du référentiel, son libellé, le nombre de messages ayant `theme_id` correspondant à ce thème et `theme_status = 'completed'`, et la part que ce nombre représente parmi tous les messages classés, triés du plus grand nombre de messages au plus petit

#### Scenario: Thème sans message classé pour l'instant
- **WHEN** un thème du référentiel n'a encore aucun message avec `theme_status = 'completed'` pointant vers lui
- **THEN** ce thème apparaît dans le classement avec un nombre de messages égal à zéro, plutôt que d'être omis

#### Scenario: Messages non encore classés exclus du classement
- **WHEN** des messages ont `theme_status` égal à `'pending'` ou `'error'`
- **THEN** ces messages ne sont comptés dans aucun thème du classement
