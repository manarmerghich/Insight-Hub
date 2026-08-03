## ADDED Requirements

### Requirement: Theme Taxonomy Discovery
Le système SHALL découvrir, une seule fois, un référentiel global de 5 à 8 thèmes (libellé + courte description) à partir d'un échantillon représentatif des messages déjà importés, via un appel au SDK Anthropic, lorsqu'aucun référentiel de thèmes n'existe encore en base.

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
Le système SHALL classer chaque message n'ayant pas encore de thème calculé (`theme_status = 'pending'` ou `'error'`) dans l'un des thèmes du référentiel existant, via un appel au SDK Anthropic.

#### Scenario: Message en attente de classification de thème
- **WHEN** un message a `theme_status = 'pending'` et qu'un référentiel de thèmes existe
- **THEN** le système l'inclut dans le prochain lot envoyé à l'IA et enregistre le thème retourné dans le champ `theme_id` du message, avec `theme_status = 'completed'`

#### Scenario: Message déjà classé avec succès
- **WHEN** un message a déjà `theme_status = 'completed'`
- **THEN** le système ne le soumet pas de nouveau à l'IA, même si l'étape de classification est réexécutée

#### Scenario: Échec de classification d'un message
- **WHEN** l'appel IA pour un lot échoue, ou retourne pour un message un libellé ne correspondant à aucun thème du référentiel
- **THEN** ce message est marqué `theme_status = 'error'` avec le détail de l'erreur enregistré, sans que cela empêche le traitement des autres messages du lot ni des lots suivants

### Requirement: Resumable Theme Batch Processing
Le système SHALL traiter les messages en attente de thème par lots au sein d'une invocation, et permettre la reprise du traitement à une invocation ultérieure sans double comptage ni perte de message.

#### Scenario: Invocation interrompue avant traitement complet
- **WHEN** une invocation de l'étape de classification de thème traite une partie des messages en attente puis s'arrête (limite de temps interne atteinte)
- **THEN** les messages non encore traités restent `theme_status = 'pending'` et sont repris lors de la prochaine invocation, sans retraiter les messages déjà `completed`

### Requirement: Theme Classification Run Tracking
Le système SHALL enregistrer chaque invocation de l'étape de classification de thème comme un run consultable, avec son statut et ses compteurs.

#### Scenario: Run terminé
- **WHEN** une invocation de l'étape de classification de thème se termine, qu'elle ait traité tout ou partie des messages en attente
- **THEN** un enregistrement de run est consultable en base avec le nombre de messages traités avec succès et le nombre de messages en erreur pour cette invocation
