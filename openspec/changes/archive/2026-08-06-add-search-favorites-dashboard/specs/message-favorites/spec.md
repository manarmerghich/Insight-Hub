## ADDED Requirements

### Requirement: Mark Message As Favorite
Le système SHALL permettre de marquer un message comme favori et de retirer ce marquage, depuis la liste de résultats affichée sur le dashboard, sans déclencher de nouveau calcul IA.

#### Scenario: Marquage d'un message comme favori
- **WHEN** l'utilisateur active le contrôle favori sur un message qui n'est pas encore marqué
- **THEN** le message est marqué comme favori et le contrôle reflète immédiatement ce nouvel état

#### Scenario: Retrait du marquage favori
- **WHEN** l'utilisateur désactive le contrôle favori sur un message déjà marqué comme favori
- **THEN** le message n'est plus marqué comme favori et le contrôle reflète immédiatement ce nouvel état

### Requirement: Favorite State Persisted And Optimistically Reflected
Le système SHALL persister l'état favori d'un message en base de données, et SHALL refléter le changement d'état dans l'interface avant confirmation de la persistance, avec retour à l'état précédent si la persistance échoue.

#### Scenario: Persistance réussie
- **WHEN** l'utilisateur bascule l'état favori d'un message et que la mise à jour en base réussit
- **THEN** l'état favori affiché reste celui choisi par l'utilisateur, et cet état est retrouvé lors d'un rechargement ultérieur de la page

#### Scenario: Échec de la persistance
- **WHEN** l'utilisateur bascule l'état favori d'un message et que la mise à jour en base échoue
- **THEN** l'interface revient à l'état favori précédent du message

### Requirement: Favorites Are Global, Not Per User
Le système SHALL considérer l'état favori d'un message comme une donnée globale au dashboard, visible identiquement par quiconque le consulte, l'application ne portant pas de notion d'utilisateur connecté.

#### Scenario: Consultation après marquage par un autre poste
- **WHEN** un message a été marqué comme favori depuis le dashboard
- **THEN** ce message apparaît comme favori pour quiconque consulte le dashboard, sans distinction de poste ou de session

### Requirement: Filter Dashboard To Favorites Only
Le système SHALL proposer, sur le dashboard, un contrôle permettant de restreindre la liste de messages affichée aux seuls messages marqués comme favoris, combinable avec la recherche plein texte et les filtres croisés existants.

#### Scenario: Activation du filtre favoris uniquement
- **WHEN** l'utilisateur active le contrôle "favoris uniquement" alors qu'au moins un message du dernier run d'import est marqué comme favori
- **THEN** la liste affichée ne contient que les messages favoris du dernier run d'import, éventuellement restreints davantage par une recherche ou des filtres croisés actifs

#### Scenario: Aucun favori dans le dernier run
- **WHEN** l'utilisateur active le contrôle "favoris uniquement" alors qu'aucun message du dernier run d'import n'est marqué comme favori
- **THEN** la page affiche un état vide dédié, sans erreur

### Requirement: Favorites Scoped To Latest Import Run For Display
Le système SHALL restreindre la vue "favoris uniquement" du dashboard aux seuls messages favoris du dernier run d'import, à l'exclusion des favoris de runs précédents, sans pour autant supprimer le marquage favori de ces messages en base.

#### Scenario: Favori marqué sur un run devenu antérieur
- **WHEN** un message marqué comme favori appartient à un run d'import qui n'est plus le dernier run
- **THEN** ce message n'apparaît pas dans la vue "favoris uniquement" du dashboard, sans que son marquage favori en base soit modifié
