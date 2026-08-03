# ai-sentiment-analysis

## Purpose

Recalculer, de façon homogène, le sentiment de chaque message déjà importé en 3 classes (positif/négatif/neutre) via le SDK Anthropic, sans jamais utiliser l'émotion d'origine du CSV (`sentiment_original`) dans ce calcul — celle-ci reste une donnée secondaire, conservée telle quelle. Cette capacité est le socle de tous les KPIs de sentiment prévus au PRD.

## ADDED Requirements

### Requirement: Sentiment Reclassification
Le système SHALL classer chaque message n'ayant pas encore de sentiment recalculé (`sentiment_status = 'pending'` ou `'error'`) dans l'une des 3 classes suivantes : positif, négatif, neutre, via un appel au SDK Anthropic.

#### Scenario: Message en attente de classification
- **WHEN** un message a `sentiment_status = 'pending'`
- **THEN** le système l'inclut dans le prochain lot envoyé à l'IA et enregistre le sentiment retourné (positif, négatif ou neutre) dans le champ `sentiment` du message, avec `sentiment_status = 'completed'`

#### Scenario: Message déjà classé avec succès
- **WHEN** un message a déjà `sentiment_status = 'completed'`
- **THEN** le système ne le soumet pas de nouveau à l'IA, même si l'étape de classification est réexécutée

#### Scenario: Échec de classification d'un message
- **WHEN** l'appel IA pour un lot échoue ou retourne une réponse invalide pour un message donné
- **THEN** ce message est marqué `sentiment_status = 'error'` avec le détail de l'erreur enregistré, sans que cela empêche le traitement des autres messages du lot ni des lots suivants

### Requirement: Original Sentiment Preservation
Le système SHALL conserver l'émotion d'origine du CSV (`sentiment_original`) sans modification et sans jamais s'en servir comme entrée du calcul de sentiment recalculé.

#### Scenario: Recalcul sans altération de la donnée d'origine
- **WHEN** un message est reclassé par l'IA
- **THEN** la valeur de `sentiment_original` du message reste strictement identique à celle enregistrée lors de l'import

### Requirement: Resumable Batch Processing
Le système SHALL traiter les messages en attente par lots au sein d'une invocation, et permettre la reprise du traitement à une invocation ultérieure sans double comptage ni perte de message.

#### Scenario: Invocation interrompue avant traitement complet
- **WHEN** une invocation de l'étape de classification traite une partie des messages en attente puis s'arrête (limite de temps interne atteinte)
- **THEN** les messages non encore traités restent `sentiment_status = 'pending'` et sont repris lors de la prochaine invocation, sans retraiter les messages déjà `completed`

### Requirement: Sentiment Classification Run Tracking
Le système SHALL enregistrer chaque invocation de l'étape de classification comme un run consultable, avec son statut et ses compteurs.

#### Scenario: Run terminé
- **WHEN** une invocation de l'étape de classification se termine, qu'elle ait traité tout ou partie des messages en attente
- **THEN** un enregistrement de run est consultable en base avec le nombre de messages traités avec succès et le nombre de messages en erreur pour cette invocation
