## ADDED Requirements

### Requirement: Trigger PDF Export From Current Dashboard Scope
Le système SHALL proposer sur le dashboard un contrôle d'export qui génère un document PDF téléchargeable reflétant exactement le scope de filtres croisés actif à l'écran (période, plateforme, pays, sentiment, thème), sans recherche plein texte ni filtre "favoris uniquement" appliqués au contenu du PDF au-delà de la section favoris dédiée.

#### Scenario: Export depuis un scope filtré
- **WHEN** l'utilisateur active le contrôle d'export alors que des filtres croisés sont appliqués sur le dashboard
- **THEN** le PDF généré restitue les KPIs calculés sur ce même scope filtré, identiques à ceux affichés à l'écran

#### Scenario: Export sans import réalisé
- **WHEN** l'utilisateur active le contrôle d'export alors qu'aucun import n'a encore été réalisé
- **THEN** le système n'engage pas de génération PDF et affiche un état empêchant l'action, cohérent avec l'état vide déjà affiché sur le dashboard

### Requirement: PDF Includes Executive Summary Without Triggering AI Generation
Le système SHALL inclure dans le PDF le résumé exécutif déjà généré par l'IA pour le scope exporté, lu depuis le cache existant, et ne SHALL JAMAIS déclencher un nouvel appel de génération IA lors de l'export.

#### Scenario: Résumé déjà en cache pour ce scope
- **WHEN** un résumé exécutif a déjà été généré et mis en cache pour le scope exporté
- **THEN** le PDF contient ce résumé, identique au texte affiché sur le dashboard

#### Scenario: Résumé absent du cache pour ce scope
- **WHEN** aucun résumé exécutif n'est en cache pour le scope exporté
- **THEN** le PDF affiche une mention indiquant que le résumé est indisponible pour ce scope, sans déclencher de génération ni faire échouer l'export

### Requirement: PDF Includes Net Sentiment Score And Evolution Chart
Le système SHALL inclure dans le PDF le score de sentiment net du scope exporté ainsi qu'un graphique de son évolution journalière, ou une mention d'absence de données si aucun message n'est classé sur ce scope.

#### Scenario: Messages classés disponibles
- **WHEN** au moins un message est classé (sentiment) dans le scope exporté
- **THEN** le PDF affiche la valeur du score de sentiment net et un graphique représentant son évolution journalière sur la période du scope

#### Scenario: Aucun message classé
- **WHEN** aucun message n'est classé dans le scope exporté
- **THEN** le PDF affiche une mention d'absence de données à la place du score et du graphique

### Requirement: PDF Includes Platform And Country Distribution Charts
Le système SHALL inclure dans le PDF un graphique de répartition des messages par plateforme et un graphique de répartition des messages par pays, calculés sur le scope exporté.

#### Scenario: Répartitions disponibles
- **WHEN** le scope exporté contient au moins un message
- **THEN** le PDF affiche, pour la plateforme et pour le pays, la part et le nombre de messages de chaque valeur présente dans le scope

#### Scenario: Aucun message dans le scope
- **WHEN** le scope exporté ne contient aucun message
- **THEN** le PDF affiche une mention d'absence de données à la place des graphiques de répartition

### Requirement: PDF Includes Favorite Messages Of The Latest Import Run
Le système SHALL inclure dans le PDF la liste des messages marqués favoris du dernier run d'import, restreinte au scope de filtres croisés exporté, et SHALL indiquer si cette liste a été tronquée par la limite déjà appliquée à l'affichage des résultats du dashboard.

#### Scenario: Favoris présents dans le scope exporté
- **WHEN** au moins un message du dernier run d'import est marqué favori et correspond au scope exporté
- **THEN** le PDF liste ces messages favoris (texte, auteur, plateforme, sentiment)

#### Scenario: Aucun favori dans le scope exporté
- **WHEN** aucun message favori du dernier run d'import ne correspond au scope exporté
- **THEN** le PDF affiche une mention d'absence de favoris à la place de la liste

#### Scenario: Nombre de favoris au-delà de la limite d'affichage
- **WHEN** le nombre de messages favoris correspondant au scope exporté dépasse la limite déjà appliquée à l'affichage des résultats du dashboard
- **THEN** le PDF liste les favoris jusqu'à cette limite et indique explicitement que la liste a été tronquée
