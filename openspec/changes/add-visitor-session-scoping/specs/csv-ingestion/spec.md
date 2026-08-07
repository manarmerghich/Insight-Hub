## MODIFIED Requirements

### Requirement: CSV Import Endpoint
Le système SHALL accepter un fichier CSV en entrée pour créer un run d'import, associé à un mot-clé de filtrage obligatoire et à l'identifiant de session du visiteur à l'origine de la demande, lui aussi obligatoire.

#### Scenario: Import direct d'un petit fichier
- **WHEN** un utilisateur envoie un fichier CSV de moins de 4.5 Mo avec un mot-clé et un identifiant de session au service d'import
- **THEN** le service crée un run d'import associé à cet identifiant de session et traite le fichier reçu directement, sans passer par Vercel Blob

#### Scenario: Import d'un gros fichier via Vercel Blob
- **WHEN** un fichier CSV dépasse 4.5 Mo
- **THEN** le service lit le fichier depuis Vercel Blob plutôt que depuis le corps de la requête HTTP, sans que cela change l'association du run à l'identifiant de session transmis

#### Scenario: Mot-clé manquant
- **WHEN** une demande d'import est reçue sans mot-clé de filtrage
- **THEN** le service refuse de créer le run et ne traite aucune ligne du fichier

#### Scenario: Identifiant de session manquant
- **WHEN** une demande d'import est reçue sans identifiant de session de visiteur
- **THEN** le service refuse de créer le run et ne traite aucune ligne du fichier, de la même manière que pour un mot-clé manquant

### Requirement: Deduplication
Le système SHALL éliminer, avant insertion, les messages déjà présents en base pour le même visiteur ou déjà rencontrés au sein du même fichier importé — jamais les messages de contenu identique appartenant à un autre visiteur.

#### Scenario: Message déjà importé par ce visiteur lors d'un run précédent
- **WHEN** un message avec la même plateforme, le même auteur, le même texte normalisé et le même timestamp existe déjà en base pour le même identifiant de session
- **THEN** la nouvelle occurrence n'est pas insérée une seconde fois

#### Scenario: Doublons au sein d'un même fichier CSV
- **WHEN** le fichier CSV importé contient plusieurs lignes identiques (même plateforme, même auteur, même texte normalisé, même timestamp)
- **THEN** une seule occurrence est conservée en base à l'issue du run

#### Scenario: Même message importé par deux visiteurs différents
- **WHEN** deux visiteurs distincts importent chacun un fichier contenant un message de plateforme, auteur, texte normalisé et timestamp identiques
- **THEN** chacun des deux messages est inséré normalement pour son propre visiteur, sans que la présence du message de l'un n'empêche l'insertion de celui de l'autre
