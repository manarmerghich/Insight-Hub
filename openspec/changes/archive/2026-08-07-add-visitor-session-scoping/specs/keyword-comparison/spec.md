## MODIFIED Requirements

### Requirement: Comparable Keyword Selection
Le système SHALL proposer, sur le dashboard, un sélecteur listant les mots-clés déjà importés par le visiteur courant (à l'exclusion de tout mot-clé importé par un autre visiteur) ayant au moins un run avec au moins un message, à l'exclusion du mot-clé du dernier run d'import de ce même visiteur (comparaison insensible à la casse).

#### Scenario: Plusieurs mots-clés importés par le même visiteur
- **WHEN** le visiteur courant consulte le dashboard et a déjà importé plusieurs mots-clés distincts sous son identifiant de session
- **THEN** le sélecteur liste chacun de ces mots-clés, à l'exception de celui du dernier run d'import, sans jamais inclure de mot-clé importé par un autre visiteur

#### Scenario: Un seul mot-clé jamais importé par ce visiteur
- **WHEN** le visiteur courant consulte le dashboard et n'a jamais importé, sous son identifiant de session, d'autre mot-clé que celui du dernier run d'import
- **THEN** le sélecteur reste visible mais désactivé, avec un message explicite invitant à importer un second mot-clé pour activer la comparaison, même si d'autres visiteurs ont importé d'autres mots-clés
