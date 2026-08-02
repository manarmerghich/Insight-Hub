# keyword-filtering

## Purpose

TBD — capture the intent of keyword-based message filtering once broader context is available (created via `add-csv-ingestion-pipeline`).

## Requirements

### Requirement: Keyword Filtering
Le système SHALL ne retenir, pour insertion en base, que les messages dont le champ `Text` normalisé contient le mot-clé du run, indépendamment de la casse.

#### Scenario: Message correspondant au mot-clé
- **WHEN** le texte normalisé d'un message contient le mot-clé du run, quelle que soit la casse
- **THEN** le message est conservé pour la suite du traitement (déduplication puis insertion)

#### Scenario: Message ne correspondant pas au mot-clé
- **WHEN** le texte normalisé d'un message ne contient pas le mot-clé du run
- **THEN** le message est exclu du run et n'est pas inséré en base

### Requirement: Keyword Persistence per Message
Le système SHALL enregistrer le mot-clé utilisé pour le filtrage avec chaque message retenu.

#### Scenario: Mot-clé associé au message importé
- **WHEN** un message est retenu après filtrage puis inséré en base
- **THEN** le mot-clé du run est enregistré avec le message, permettant de distinguer ultérieurement les messages associés à des mots-clés différents (comparaison à deux mots-clés)
