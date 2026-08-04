## ADDED Requirements

### Requirement: Automatic Trigger After Import
Le système SHALL déclencher automatiquement l'étape de classification de thème juste après qu'un run d'import ait inséré au moins un nouveau message, sans action manuelle de l'utilisateur.

#### Scenario: Import réussi avec au moins un nouveau message
- **WHEN** un run d'import se termine avec succès et a inséré au moins un nouveau message
- **THEN** le système déclenche immédiatement l'étape de classification de thème, dans la foulée du run d'import (après la classification de sentiment)

#### Scenario: Import sans nouveau message
- **WHEN** un run d'import se termine avec succès mais n'a inséré aucun nouveau message (doublons, aucune correspondance de mot-clé)
- **THEN** le système ne déclenche pas de nouvelle classification de thème

#### Scenario: Échec de la classification déclenchée automatiquement
- **WHEN** la classification de thème déclenchée automatiquement échoue
- **THEN** le statut du run d'import reste inchangé (`completed`) — l'échec de la classification n'est jamais reporté sur le statut de l'import

## MODIFIED Requirements

### Requirement: Theme Taxonomy Discovery
Le système SHALL découvrir, une seule fois, un référentiel global de 5 à 8 thèmes (libellé + courte description) à partir d'un échantillon représentatif des messages déjà importés, via un appel à un SDK IA avec sortie structurée (actuellement : SDK Gemini, `google-genai`), lorsqu'aucun référentiel de thèmes n'existe encore en base.

#### Scenario: Aucun référentiel de thèmes n'existe encore
- **WHEN** l'étape de classification de thème est déclenchée et qu'aucune ligne n'existe dans la table des thèmes
- **THEN** le système sélectionne un échantillon plafonné de messages, demande à l'IA de produire entre 5 et 8 thèmes distincts, puis enregistre ce référentiel en base avant de poursuivre avec la classification des messages

#### Scenario: Un référentiel de thèmes existe déjà
- **WHEN** l'étape de classification de thème est déclenchée et qu'au moins un thème existe déjà en base
- **THEN** le système ne relance pas la découverte et classe directement les messages en attente avec le référentiel existant

#### Scenario: Échec de la découverte du référentiel
- **WHEN** l'appel IA de découverte échoue ou retourne une réponse invalide (moins de 5 ou plus de 8 thèmes exploitables)
- **THEN** aucun thème n'est enregistré en base, aucun message n'est classé lors de cette invocation, et la découverte est retentée lors d'une invocation ultérieure

### Requirement: Message Theme Classification
Le système SHALL classer chaque message n'ayant pas encore de thème calculé (`theme_status = 'pending'` ou `'error'`) dans l'un des thèmes du référentiel existant, via un appel à un SDK IA avec sortie structurée (actuellement : SDK Gemini, `google-genai`).

#### Scenario: Message en attente de classification de thème
- **WHEN** un message a `theme_status = 'pending'` et qu'un référentiel de thèmes existe
- **THEN** le système l'inclut dans le prochain lot envoyé à l'IA et enregistre le thème retourné dans le champ `theme_id` du message, avec `theme_status = 'completed'`

#### Scenario: Message déjà classé avec succès
- **WHEN** un message a déjà `theme_status = 'completed'`
- **THEN** le système ne le soumet pas de nouveau à l'IA, même si l'étape de classification est réexécutée

#### Scenario: Échec de classification d'un message
- **WHEN** l'appel IA pour un lot échoue, ou retourne pour un message un libellé ne correspondant à aucun thème du référentiel
- **THEN** ce message est marqué `theme_status = 'error'` avec le détail de l'erreur enregistré, sans que cela empêche le traitement des autres messages du lot ni des lots suivants
