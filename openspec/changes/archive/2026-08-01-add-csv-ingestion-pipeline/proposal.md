## Why

Le pipeline d'ingestion est le socle du MVP (PRD section 3 : "Fondations, aucune dépendance IA"). Sans import CSV fiable, normalisé, dédupliqué et filtré sur le mot-clé de la marque suivie, aucune analyse IA en aval (sentiment, thèmes, synthèse) ne peut produire de résultats fiables ni traçables — tout le reste de la chaîne de dépendances du PRD en découle.

## What Changes

- Ajout d'un point d'entrée d'import CSV côté service `insight-hub-pipeline` (upload direct, ou lecture depuis Vercel Blob si le fichier dépasse 4.5 Mo).
- Normalisation systématique des champs texte et date à l'import : suppression des espaces parasites (`Text`, `Sentiment`, `User`, `Platform`, `Country`), parsing homogène du `Timestamp`.
- Déduplication des messages importés (même source + même contenu déjà présent en base).
- Filtrage des messages par mot-clé simulant la marque suivie : le mot-clé est un paramètre du run d'import (pas codé en dur), pour permettre la comparaison à deux mots-clés prévue en V2.
- Écriture en base (Neon Postgres) des messages retenus après normalisation/déduplication/filtrage, avec traçabilité systématique (source de l'import, date de collecte).

## Capabilities

### New Capabilities
- `csv-ingestion` : lecture d'un CSV brut, normalisation des champs, déduplication, écriture des messages en base avec traçabilité (source, date de collecte).
- `keyword-filtering` : filtrage des messages importés selon un mot-clé simulant la marque suivie, paramétrable par run d'import.

### Modified Capabilities
_Aucune — aucun spec existant à ce jour dans `openspec/specs/`._

## Impact

- Nouveau service `insight-hub-pipeline` (Python ≥3.12) : nouvelle route d'import, modules de normalisation, déduplication et filtrage.
- Nouvelle table `messages` dans le schéma Neon (schéma possédé par Drizzle côté `insight-hub-web`) : nécessite une migration Drizzle pour créer la table et ses colonnes de traçabilité avant que le pipeline Python puisse y écrire.
- Aucun appel IA dans ce change (fondations uniquement, cf. PRD section 3 — sentiment/thèmes/synthèse font l'objet de changes ultérieurs qui dépendront de celui-ci).
- Hors scope : l'UI d'upload dans `insight-hub-web` (déclenchement du run, affichage du statut) — traitée dans un change séparé si nécessaire.
