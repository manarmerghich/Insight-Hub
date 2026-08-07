## Why

L'application est déployée en production sans aucune notion de compte : toutes les données (imports, messages, résumés IA) sont stockées dans une base Neon unique et partagée. Résultat concret déjà observé : un visiteur qui ouvre l'app pour la première fois voit l'historique laissé par d'autres sessions (données de test ou d'un autre visiteur), au lieu d'un tableau de bord vierge. Purger la base une fois (déjà fait) ne règle que le symptôme immédiat — le prochain visiteur qui importe un mot-clé polluera la vue de tous les visiteurs suivants. Il faut une isolation structurelle, sans pour autant introduire un vrai système de comptes (hors périmètre du PRD, qui décrit un outil à usage individuel).

## What Changes

- Attribution d'un identifiant de session anonyme (cookie signé, sans mot de passe ni email) à chaque visiteur dès sa première requête sur `insight-hub-web`.
- **BREAKING** : `import_runs` porte désormais un `visitor_id` obligatoire ; toute lecture de données (dashboard, filtres, export PDF, comparaison de mots-clés, résumé exécutif, recherche, favoris) est scopée à ce `visitor_id` plutôt qu'au dernier run global.
- `insight-hub-pipeline` reçoit et enregistre le `visitor_id` transmis par `insight-hub-web` lors de la création d'un run d'import (aucun changement de son modèle d'authentification bearer token existant).
- La liste des mots-clés proposés pour comparaison (`keyword-comparison`) est restreinte aux imports du visiteur courant — actuellement elle expose tous les mots-clés jamais importés, tous visiteurs confondus, ce qui fuiterait les mots-clés d'un autre visiteur même après isolation des données.
- Un visiteur qui vide ses cookies ou change de navigateur perd l'accès à son historique (nouvel identifiant, nouvel état vide) — comportement accepté, documenté comme limite plutôt que corrigé par un vrai compte.

## Capabilities

### New Capabilities
- `visitor-session-identity` : attribution, persistance (cookie) et résolution côté serveur de l'identifiant de session anonyme, pour chaque requête sur `insight-hub-web`.

### Modified Capabilities
- `csv-ingestion` : le run d'import créé par `insight-hub-pipeline` doit être associé à l'identifiant de visiteur transmis par `insight-hub-web`, requis au même titre que le mot-clé.
- `keyword-comparison` : le Requirement "Comparable Keyword Selection" doit restreindre la liste des mots-clés comparables aux imports du visiteur courant (actuellement formulé sans notion de propriétaire, donc implicitement global).

## Impact

- **Schéma** (`insight-hub-web`, Drizzle) : nouvelle colonne `visitor_id` sur `import_runs` (+ migration). Pas de changement sur `messages` (déjà scopée via `run_id`).
- **`insight-hub-web`** : nouveau middleware/helper d'attribution et de lecture du cookie de session ; toutes les fonctions de `src/db/*.ts` qui résolvent actuellement "le dernier run d'import" de façon globale (`latest-import-run.ts`, `dashboard-filter-options.ts`, `keyword-comparison.ts`, et par extension toutes les pages qui en dépendent : `dashboard/page.tsx`, export PDF, résumé exécutif) doivent recevoir et appliquer le `visitor_id` courant. Aucun changement de leurs Requirements métier — seule la définition de "le run courant" change (implémentation, pas contrat).
- **`insight-hub-pipeline`** : `POST /api/import` accepte et enregistre un `visitor_id` (nouveau champ de formulaire, requis) ; aucun changement du modèle d'authentification bearer token existant.
- **Migration des données existantes** : les runs déjà en base (post-purge, potentiellement recréés avant ce changement) n'ont pas de `visitor_id` — à traiter explicitement en `design.md` (probablement : rattachement à un visiteur "legacy" invisible de tout nouveau visiteur, ou purge, à trancher).
- **Pas de nouvelle dépendance** : cookie signé applicatif (ex. `next/headers` + signature HMAC), pas de bibliothèque d'authentification complète (pas de compte, pas de mot de passe).
