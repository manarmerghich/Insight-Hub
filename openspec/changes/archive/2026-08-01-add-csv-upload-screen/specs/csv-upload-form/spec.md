## ADDED Requirements

### Requirement: CSV Upload Form
Le système SHALL afficher un formulaire permettant de saisir un mot-clé obligatoire et de sélectionner un fichier CSV, en vue de déclencher un run d'import.

#### Scenario: Soumission valide
- **WHEN** l'utilisateur saisit un mot-clé et sélectionne un fichier CSV puis soumet le formulaire
- **THEN** le système déclenche un run d'import auprès du service `insight-hub-pipeline`

#### Scenario: Mot-clé manquant à la soumission
- **WHEN** l'utilisateur soumet le formulaire sans avoir renseigné de mot-clé
- **THEN** le système affiche une erreur bloquante et n'effectue aucun appel réseau vers le service pipeline

#### Scenario: Fichier manquant à la soumission
- **WHEN** l'utilisateur soumet le formulaire sans avoir sélectionné de fichier
- **THEN** le système affiche une erreur bloquante et n'effectue aucun appel réseau vers le service pipeline

### Requirement: Direct Submission for Small Files
Le système SHALL soumettre directement le contenu du fichier au service pipeline lorsque sa taille est inférieure à 4.5 Mo, sans passer par Vercel Blob.

#### Scenario: Fichier sous le seuil
- **WHEN** le fichier sélectionné fait moins de 4.5 Mo
- **THEN** le système transmet le fichier directement, sans upload préalable vers Vercel Blob

### Requirement: Blob Upload Fallback for Large Files
Le système SHALL basculer vers un upload direct du fichier vers Vercel Blob lorsque sa taille atteint ou dépasse 4.5 Mo, puis transmettre uniquement l'URL Blob obtenue au service pipeline.

#### Scenario: Fichier au-delà du seuil
- **WHEN** le fichier sélectionné fait 4.5 Mo ou plus
- **THEN** le système envoie le fichier directement à Vercel Blob depuis le navigateur, puis déclenche le run d'import avec l'URL Blob obtenue

#### Scenario: Jeton Blob à usage limité
- **WHEN** le navigateur a besoin d'uploader un fichier vers Vercel Blob
- **THEN** le système lui fournit un jeton à usage unique généré côté serveur, distinct du jeton d'accès Blob permanent

### Requirement: Server-Side Secret Handling
Le système SHALL garantir qu'aucun secret d'authentification (jeton du service pipeline, jeton d'accès Blob permanent) n'est inclus dans le code exécuté côté client.

#### Scenario: Appel au service pipeline effectué côté serveur
- **WHEN** le formulaire est soumis
- **THEN** l'appel HTTP authentifié vers `insight-hub-pipeline` est effectué depuis du code exécuté sur le serveur `insight-hub-web`, jamais directement depuis le navigateur

### Requirement: Submission Error Display
Le système SHALL afficher un message d'erreur explicite lorsque la soumission échoue, que l'échec provienne du service pipeline ou d'un problème réseau.

#### Scenario: Erreur renvoyée par le service pipeline
- **WHEN** le service pipeline refuse la requête (mot-clé absent, fichier illisible)
- **THEN** le système affiche le message d'erreur retourné par le pipeline dans le formulaire

#### Scenario: Service pipeline injoignable
- **WHEN** l'appel réseau vers le service pipeline échoue (timeout, service indisponible)
- **THEN** le système affiche un message d'erreur générique indiquant que la soumission a échoué
