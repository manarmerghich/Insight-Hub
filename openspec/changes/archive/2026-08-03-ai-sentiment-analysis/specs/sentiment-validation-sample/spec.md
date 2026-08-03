# sentiment-validation-sample

## Purpose

Prouver la fiabilité du recalcul de sentiment par l'IA ([[ai-sentiment-analysis]]) via un échantillon annoté manuellement, hors ligne, plutôt que par un score de confiance affiché message par message. L'objectif du PRD est un taux d'accord de 80% entre l'annotation manuelle et le sentiment recalculé par l'IA.

## ADDED Requirements

### Requirement: Stratified Sample Selection
Le système SHALL constituer un échantillon de validation en tirant aléatoirement, parmi les messages déjà classés avec succès (`sentiment_status = 'completed'`), un nombre minimal de messages par classe de sentiment (positif, négatif, neutre), ce nombre étant paramétrable.

#### Scenario: Tirage équilibré par classe
- **WHEN** un tirage d'échantillon est demandé avec une taille de N messages par classe
- **THEN** l'échantillon constitué contient au moins N messages de chaque classe de sentiment, si suffisamment de messages classés existent pour chaque classe

#### Scenario: Classe sous-représentée
- **WHEN** une classe de sentiment compte, parmi les messages déjà classés, moins de messages que la taille N demandée
- **THEN** tous les messages disponibles de cette classe sont inclus dans l'échantillon, le tirage n'échoue pas, et ce sous-effectif est signalé dans le résultat du tirage

### Requirement: Sample Export For Manual Annotation
Le système SHALL permettre l'export d'un échantillon de validation vers un fichier CSV contenant, pour chaque message échantillonné, son identifiant, son texte, son sentiment recalculé par l'IA, et une colonne vide destinée à l'annotation manuelle.

#### Scenario: Export d'un échantillon tiré
- **WHEN** un échantillon de validation a été constitué
- **THEN** un fichier CSV est généré avec une ligne par message échantillonné, incluant l'identifiant du message, son texte, son sentiment IA, et une colonne d'annotation manuelle vide

### Requirement: Annotation Reimport And Validation
Le système SHALL réimporter un fichier CSV annoté manuellement, en validant que chaque ligne porte une annotation manuelle appartenant aux 3 classes attendues (positif, négatif, neutre) avant de l'enregistrer.

#### Scenario: Réimport d'un fichier entièrement annoté
- **WHEN** le fichier CSV réimporté contient une annotation manuelle valide (positif, négatif ou neutre) pour chaque ligne de l'échantillon
- **THEN** chaque annotation est enregistrée en base, associée au message correspondant de l'échantillon

#### Scenario: Annotation manquante ou invalide
- **WHEN** une ligne du fichier réimporté a une annotation manuelle vide ou ne correspondant à aucune des 3 classes attendues
- **THEN** le réimport signale cette ligne comme invalide et n'enregistre pas d'annotation pour ce message, sans empêcher l'enregistrement des lignes valides du même fichier

### Requirement: Agreement Rate Calculation
Le système SHALL calculer un taux d'accord entre l'annotation manuelle et le sentiment recalculé par l'IA, à partir des messages annotés d'un échantillon, et le rendre consultable sans déclencher d'action automatique.

#### Scenario: Calcul du taux d'accord
- **WHEN** toutes les annotations valides d'un échantillon ont été enregistrées
- **THEN** le système calcule et enregistre le taux d'accord comme la proportion de messages annotés dont l'annotation manuelle correspond au sentiment IA snapshotté au moment du tirage

#### Scenario: Taux d'accord sous l'objectif de 80%
- **WHEN** le taux d'accord calculé pour un échantillon est inférieur à 80%
- **THEN** le système enregistre et rend consultable ce taux ainsi que la liste des messages en désaccord, sans marquer le run en échec ni déclencher de correction automatique
