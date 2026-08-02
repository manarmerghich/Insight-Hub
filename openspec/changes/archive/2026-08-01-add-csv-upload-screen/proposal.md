## Why

Le pipeline d'import CSV existe côté service `insight-hub-pipeline` (route `POST /api/import`, normalisation, filtrage, déduplication) mais n'est déclenchable que par un appel HTTP direct authentifié par bearer token. Aucune interface ne permet au responsable marketing/communication (persona cible du PRD) de lancer un import ni d'en suivre l'avancement : sans cet écran, les fondations du MVP restent inutilisables en pratique par l'utilisateur final.

## What Changes

- Nouvel écran (route Next.js dans `insight-hub-web`) avec un formulaire d'upload : mot-clé obligatoire + sélection d'un fichier CSV.
- Soumission traitée côté serveur (Server Action / Route Handler Next.js), jamais par un appel direct du navigateur vers `insight-hub-pipeline` avec le bearer token — pour respecter la contrainte projet « ne jamais exposer les clés API au client ».
- Bascule transparente vers Vercel Blob pour les fichiers dépassant 4.5 Mo, cohérente avec le support déjà implémenté côté pipeline (`blob_url`).
- Affichage des erreurs de soumission (mot-clé manquant, fichier illisible, échec réseau) directement dans le formulaire.
- Affichage du statut du run après soumission (en cours / terminé / erreur), actualisé par polling depuis Postgres tant que le run n'est pas terminé — pas de push temps réel, cohérent avec l'architecture actée.
- Bootstrap du projet Next.js `insight-hub-web` (App Router, TypeScript) : à ce jour, seul le schéma Drizzle existe, aucune application Next.js n'a encore été scaffoldée.

## Capabilities

### New Capabilities
- `csv-upload-form` : formulaire d'upload d'un CSV avec mot-clé obligatoire, déclenchement de l'import via le service `insight-hub-pipeline` (upload direct ou bascule Vercel Blob selon la taille du fichier), sans jamais exposer de secret d'authentification au client.
- `import-run-status-display` : affichage du statut d'un run d'import (en cours / terminé / erreur) consultable depuis Postgres, avec actualisation périodique tant que le run n'est pas terminé.

### Modified Capabilities
_Aucune — aucun spec n'est encore synchronisé dans `openspec/specs/` à ce jour._

## Impact

- Nouveau scaffolding Next.js dans `insight-hub-web` (App Router, layout, page d'upload, composant de formulaire) : à ce jour ce projet ne contient que la configuration Drizzle et le schéma de base.
- Nouvelle Server Action / Route Handler côté `insight-hub-web` portant l'appel HTTP vers `insight-hub-pipeline` (`PIPELINE_SERVICE_URL` + `PIPELINE_AUTH_TOKEN`), aucun de ces secrets n'atteint le bundle client.
- Dépend du endpoint `POST /api/import` du service `insight-hub-pipeline`, déjà implémenté dans le change `add-csv-ingestion-pipeline` (non encore archivé mais fonctionnel et testé).
- Aucun changement de schéma de base de données — cet écran ne fait que lire/écrire via les mécanismes déjà en place (`import_runs`, `messages`).
- Test Playwright requis en fin de développement (contrainte projet) pour valider que l'écran est responsive et fonctionnel.
