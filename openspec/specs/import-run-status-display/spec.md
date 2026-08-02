# import-run-status-display

## Purpose
TBD - captured from the `add-csv-upload-screen` change. Provides the run status display in `insight-hub-web` that polls an import run's status until it reaches a terminal state, and disambiguates zero-result outcomes (no keyword match vs. all-already-imported).

## Requirements

### Requirement: Run Status Polling
Le système SHALL interroger périodiquement le statut du run d'import tant que celui-ci n'est pas dans un état terminal (`completed` ou `error`).

#### Scenario: Suivi automatique après déclenchement
- **WHEN** un run d'import vient d'être déclenché et son statut est `running`
- **THEN** le système affiche l'état « en cours » et actualise automatiquement le statut sans action de l'utilisateur, jusqu'à atteindre un état terminal

### Requirement: Terminal Status Display
Le système SHALL afficher le résultat final du run et arrêter le polling dès que le statut atteint un état terminal.

#### Scenario: Run terminé avec succès
- **WHEN** le statut du run devient `completed`
- **THEN** le système affiche le nombre de messages retenus et cesse d'interroger le statut

#### Scenario: Run en erreur
- **WHEN** le statut du run devient `error`
- **THEN** le système affiche le message d'erreur associé au run et cesse d'interroger le statut

### Requirement: Disambiguated Zero-Result Display
Le système SHALL distinguer, à l'affichage, une absence de correspondance au mot-clé d'une réimportation de messages déjà connus, plutôt que d'afficher un même « 0 message(s) retenu(s) » ambigu dans les deux cas.

#### Scenario: Aucune correspondance au mot-clé
- **WHEN** le run est terminé et qu'aucun message ne correspond au mot-clé (nombre de correspondances nul)
- **THEN** le système affiche que le mot-clé ne correspond à aucun message, sans faire référence à une déduplication

#### Scenario: Messages correspondants déjà tous importés précédemment
- **WHEN** le run est terminé, que des messages correspondent au mot-clé, mais qu'aucun n'est nouveau (tous déjà présents en base)
- **THEN** le système affiche le nombre de messages correspondant au mot-clé et précise qu'ils étaient déjà importés, plutôt que de laisser croire à une absence de correspondance
