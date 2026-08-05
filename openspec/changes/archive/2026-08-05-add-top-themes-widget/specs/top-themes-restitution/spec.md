## MODIFIED Requirements

### Requirement: Theme Ranking By Volume
Le système SHALL restituer, sur le dashboard, le classement des thèmes du référentiel existant triés par nombre décroissant de messages classés dans chacun, scopé au dernier run d'import et restreint par les filtres croisés période, plateforme, pays et sentiment actifs sur le dashboard, sans déclencher de nouveau calcul IA.

#### Scenario: Classement affiché sur le dashboard
- **WHEN** l'utilisateur consulte la page dashboard
- **THEN** la page affiche, pour chaque thème du référentiel, son libellé, le nombre de messages du dernier run d'import ayant `theme_id` correspondant à ce thème, `theme_status = 'completed'` et respectant les filtres croisés période/plateforme/pays/sentiment actifs, ainsi que la part que ce nombre représente parmi les messages classés de ce même scope, triés du plus grand nombre de messages au plus petit

#### Scenario: Thème sans message classé pour ce scope
- **WHEN** un thème du référentiel n'a aucun message avec `theme_status = 'completed'` correspondant au dernier run d'import et aux filtres croisés actifs
- **THEN** ce thème apparaît dans le classement avec un nombre de messages égal à zéro, plutôt que d'être omis

#### Scenario: Messages non encore classés exclus du classement
- **WHEN** des messages du dernier run d'import ont `theme_status` égal à `'pending'` ou `'error'`
- **THEN** ces messages ne sont comptés dans aucun thème du classement

#### Scenario: Aucun run d'import disponible
- **WHEN** aucun run d'import n'existe encore
- **THEN** le dashboard affiche un état vide pour le classement des thèmes, sans erreur
