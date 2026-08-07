## ADDED Requirements

### Requirement: Anonymous Visitor Identifier Assignment
Le système SHALL attribuer, dès la première requête d'un visiteur n'ayant pas encore d'identifiant de session, un identifiant anonyme unique (aucune saisie d'email, de mot de passe, ni de compte), avant le rendu de la première page.

#### Scenario: Première visite, aucune donnée saisie requise
- **WHEN** un navigateur effectue sa première requête vers l'application sans cookie d'identifiant de session
- **THEN** le système génère un identifiant unique et le pose en cookie, sans demander aucune information au visiteur

#### Scenario: Identifiant déjà présent
- **WHEN** un navigateur effectue une requête avec un cookie d'identifiant de session déjà valide
- **THEN** le système réutilise cet identifiant sans en générer un nouveau

### Requirement: Visitor Identifier Persistence
Le système SHALL conserver l'identifiant de session dans un cookie porté par le navigateur, sans stockage d'aucune donnée d'identification personnelle (pas d'email, pas de nom).

#### Scenario: Requêtes successives du même navigateur
- **WHEN** le même navigateur effectue plusieurs requêtes séparées dans le temps, sans avoir supprimé ses cookies
- **THEN** chacune de ces requêtes est associée au même identifiant de session, et donc aux mêmes données

#### Scenario: Cookies supprimés ou navigateur différent
- **WHEN** un visiteur a supprimé ses cookies, utilise la navigation privée, ou change de navigateur ou d'appareil
- **THEN** un nouvel identifiant est attribué, distinct du précédent, sans accès aux données associées à l'identifiant précédent

### Requirement: Per-Visitor Data Isolation
Le système SHALL restreindre, pour chaque fonctionnalité exposant des données issues d'un import (dashboard, filtres croisés, recherche, favoris, export PDF, résumé exécutif, comparaison de mots-clés), la restitution aux seules données associées à l'identifiant de session du visiteur courant.

#### Scenario: Nouveau visiteur, aucun import préalable
- **WHEN** un visiteur consulte le dashboard pour la première fois, sans avoir jamais importé de données sous son identifiant de session
- **THEN** toutes les cartes du dashboard affichent leur état vide, quelles que soient les données déjà importées par d'autres visiteurs

#### Scenario: Deux visiteurs distincts, données non partagées
- **WHEN** deux visiteurs avec des identifiants de session différents ont chacun importé des données sous un mot-clé différent
- **THEN** aucun des deux ne voit, dans son dashboard, sa recherche, ses favoris ou son export PDF, les données importées par l'autre

#### Scenario: Comparaison de mots-clés sans fuite entre visiteurs
- **WHEN** un visiteur consulte le sélecteur de mots-clés comparables sur le dashboard
- **THEN** seuls les mots-clés déjà importés par ce même visiteur y apparaissent, jamais ceux importés par un autre visiteur
