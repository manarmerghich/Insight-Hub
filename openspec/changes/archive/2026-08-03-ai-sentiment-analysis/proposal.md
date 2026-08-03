## Why

Le sentiment brut du CSV (`Sentiment`, colonne texte libre à granularité fine) n'est pas homogène et ne peut pas alimenter directement les KPIs du PRD (Sentiment Score net, pondération par engagement, détection de pics). Le PRD impose un recalcul par l'IA en 3 classes (positif/négatif/neutre) pour une méthode homogène, tout en conservant l'émotion d'origine comme donnée secondaire. C'est la première étape de la chaîne de dépendances IA (sentiment → thèmes → synthèse) : aucun KPI de sentiment ni aucune capacité en aval ne peut être construit sans elle. Le PRD (section 1.8 et F) exige aussi que la fiabilité de ce recalcul soit prouvée par un échantillon annoté manuellement (objectif 80% d'accord), plutôt que par un score de confiance affiché message par message.

## What Changes

- Ajout d'une étape de recalcul du sentiment dans le pipeline Python (`insight-hub-pipeline`) : chaque message déjà importé (table `messages`) est classé en 3 classes (positif/négatif/neutre) via le SDK Anthropic Python.
- L'émotion d'origine du CSV (déjà stockée dans `sentiment_original`) reste inchangée et continue d'être traitée comme donnée secondaire, jamais utilisée pour les KPIs.
- Le résultat du recalcul (sentiment 3 classes) est écrit en base par message, avec un statut permettant de savoir si un message a déjà été traité par cette étape (pour ne pas re-payer un appel IA à chaque run).
- Ajout d'un mécanisme de validation de fiabilité : constitution d'un échantillon de messages tirés parmi ceux déjà classés, annotation manuelle de cet échantillon (3 classes), et calcul d'un taux d'accord entre l'annotation manuelle et le sentiment recalculé par l'IA. Objectif : 80% d'accord.
- Aucune correction interactive du sentiment message par message (hors périmètre, PRD section F) : l'échantillon annoté sert uniquement à mesurer la fiabilité globale, pas à corriger les messages.

## Capabilities

### New Capabilities
- `ai-sentiment-analysis` : recalcul du sentiment en 3 classes (positif/négatif/neutre) via le SDK Anthropic sur les messages déjà importés, conservation de l'émotion d'origine en donnée secondaire, idempotence du traitement par message.
- `sentiment-validation-sample` : constitution d'un échantillon stratifié par classe de sentiment parmi les messages déjà classés, export CSV pour annotation manuelle hors ligne, réimport de l'annotation, calcul et restitution du taux d'accord entre annotation manuelle et sentiment IA (sans blocage automatique si l'objectif de 80% n'est pas atteint).

### Modified Capabilities
_Aucune — `csv-ingestion` reste inchangé : le recalcul de sentiment est une étape distincte, exécutée après l'ingestion, sur des messages déjà en base._

## Impact

- Nouvelle dépendance dans `insight-hub-pipeline` : SDK Anthropic Python (`anthropic`), utilisant `ANTHROPIC_API_KEY` (déjà présent dans `.env.example`).
- Nouvelles colonnes sur la table `messages` (schéma Neon, possédé par Drizzle côté `insight-hub-web`) : sentiment recalculé (3 classes) et statut de traitement du sentiment — nécessite une migration Drizzle avant que le pipeline Python puisse y écrire.
- Nouvelle table pour l'échantillon annoté (message échantillonné, annotation manuelle, sentiment IA au moment de l'échantillonnage) — nécessite également une migration Drizzle.
- Nouvelle route/étape déclenchable dans `insight-hub-pipeline` pour lancer le recalcul de sentiment sur les messages en attente d'un run d'import donné (ou de tous les runs), en s'appuyant sur le pipeline synchrone existant (`app/workflows.py`) plutôt que sur Vercel Workflows (abandonné, voir `ARCHITECTURE.md` — le SDK Python est en beta et non exerçable en local/CI).
- Hors scope de ce change : restitution dans le dashboard (Sentiment Score net, nuage de mots, etc.) et interface de saisie de l'annotation manuelle côté `insight-hub-web` — traités dans des changes séparés si nécessaire.
