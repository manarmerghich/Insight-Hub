# csv-ingestion

## Purpose

TBD — capture the intent of CSV import ingestion once broader context is available (created via `add-csv-ingestion-pipeline`).

## Requirements

### Requirement: CSV Import Endpoint
Le système SHALL accepter un fichier CSV en entrée pour créer un run d'import, associé à un mot-clé de filtrage obligatoire.

#### Scenario: Import direct d'un petit fichier
- **WHEN** un utilisateur envoie un fichier CSV de moins de 4.5 Mo avec un mot-clé au service d'import
- **THEN** le service crée un run d'import et traite le fichier reçu directement, sans passer par Vercel Blob

#### Scenario: Import d'un gros fichier via Vercel Blob
- **WHEN** un fichier CSV dépasse 4.5 Mo
- **THEN** le service lit le fichier depuis Vercel Blob plutôt que depuis le corps de la requête HTTP

#### Scenario: Mot-clé manquant
- **WHEN** une demande d'import est reçue sans mot-clé de filtrage
- **THEN** le service refuse de créer le run et ne traite aucune ligne du fichier

### Requirement: Field Normalization
Le système SHALL normaliser les champs texte et date de chaque ligne importée avant tout traitement ultérieur (filtrage, déduplication, écriture).

#### Scenario: Suppression des espaces parasites
- **WHEN** une ligne du CSV contient des espaces en début, en fin, ou multiples dans les champs `Text`, `Sentiment`, `User`, `Platform` ou `Country`
- **THEN** ces champs sont nettoyés des espaces superflus avant d'être comparés, filtrés ou stockés

#### Scenario: Parsing homogène du timestamp
- **WHEN** une ligne contient un champ `Timestamp` au format texte
- **THEN** le système le convertit en une date/heure structurée unique, utilisée pour tous les traitements et restitutions ultérieurs

### Requirement: Deduplication
Le système SHALL éliminer, avant insertion, les messages déjà présents en base ou déjà rencontrés au sein du même fichier importé.

#### Scenario: Message déjà importé lors d'un run précédent
- **WHEN** un message avec la même plateforme, le même auteur, le même texte normalisé et le même timestamp existe déjà en base
- **THEN** la nouvelle occurrence n'est pas insérée une seconde fois

#### Scenario: Doublons au sein d'un même fichier CSV
- **WHEN** le fichier CSV importé contient plusieurs lignes identiques (même plateforme, même auteur, même texte normalisé, même timestamp)
- **THEN** une seule occurrence est conservée en base à l'issue du run

### Requirement: Message Traceability
Le système SHALL enregistrer la source et la date de collecte de chaque message importé.

#### Scenario: Traçabilité à l'insertion
- **WHEN** un message est inséré en base après normalisation, filtrage et déduplication
- **THEN** il est associé au run d'import qui l'a créé, au nom du fichier source, et à la date/heure de collecte, distincte de la date de publication du message

### Requirement: Import Run Status
Le système SHALL exposer un statut consultable en base pour chaque run d'import.

#### Scenario: Run terminé avec succès
- **WHEN** toutes les lignes du CSV ont été normalisées, filtrées, dédupliquées et insérées sans erreur
- **THEN** le statut du run est marqué comme terminé, avec le nombre de messages retenus

#### Scenario: Run en erreur
- **WHEN** une erreur survient pendant le traitement d'un run (fichier illisible, format invalide)
- **THEN** le statut du run est marqué en erreur et le message d'erreur associé est consultable en base

### Requirement: Match Count Distinct From Retained Count
Le système SHALL enregistrer, en plus du nombre de messages retenus (nouveaux, après déduplication), le nombre de messages ayant correspondu au mot-clé avant déduplication, afin de distinguer une absence de correspondance d'une réimportation de messages déjà connus.

#### Scenario: Réimport d'un même fichier avec le même mot-clé
- **WHEN** un run réimporte un fichier déjà importé avec le même mot-clé, et qu'aucun message n'est donc réellement nouveau
- **THEN** le nombre de messages retenus est de zéro, mais le nombre de messages ayant correspondu au mot-clé reste égal au nombre de correspondances réelles, non nul
