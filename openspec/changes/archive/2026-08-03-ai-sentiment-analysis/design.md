## Context

La table `messages` existe déjà (change `add-csv-ingestion-pipeline`) et contient `sentiment_original` (l'émotion brute du CSV, déjà conservée). Aucune colonne ne porte encore de sentiment recalculé. Le pipeline (`insight-hub-pipeline`) est un service Python synchrone (`app/workflows.py`) : Vercel Workflows a été abandonné pour l'ingestion CSV (SDK Python en beta, non exerçable en local/CI — voir `ARCHITECTURE.md`), au profit d'étapes séquentielles idempotentes, re-déclenchables sans effet de bord grâce à `ON CONFLICT DO NOTHING`. Ce change doit rester cohérent avec ce choix : pas de nouvelle orchestration durable.

Le schéma Neon est possédé par Drizzle (`insight-hub-web`) ; toute nouvelle colonne/table nécessite une migration `drizzle-kit` avant que le pipeline Python ne puisse lire/écrire.

## Goals / Non-Goals

**Goals:**
- Recalculer le sentiment de chaque message déjà importé en 3 classes (positif/négatif/neutre) via le SDK Anthropic, de façon idempotente et re-déclenchable (même contrainte que l'ingestion CSV).
- Conserver `sentiment_original` intact et ne jamais l'utiliser dans le calcul des KPIs.
- Mesurer la fiabilité du recalcul via un échantillon stratifié par classe, annoté manuellement hors ligne, avec calcul d'un taux d'accord.

**Non-Goals:**
- Pas de restitution dashboard des KPIs de sentiment (Sentiment Score net, nuage de mots, etc.) — change séparé.
- Pas de correction interactive du sentiment message par message (exclu par le PRD, section F).
- Pas d'interface web pour l'annotation manuelle — l'annotation se fait hors ligne dans un fichier CSV.
- Pas de blocage automatique si le taux d'accord mesuré est sous 80% — c'est un constat consultable, la décision d'ajuster (prompt, modèle) reste humaine.

## Decisions

### Modèle et appel IA : appels synchrones par lot, pas la Message Batches API
Chaque invocation de l'étape de classification traite les messages en attente (`sentiment_status = 'pending'`) par lots (défaut : 25 messages par appel), un seul appel `messages.create` par lot, avec **tool use en mode strict** forçant une sortie structurée `{"results": [{"id": int, "sentiment": "positif"|"négatif"|"neutre"}]}` — pas de parsing de texte libre.

- **Alternative envisagée et écartée** : l'API **Message Batches** d'Anthropic (moins chère, pensée pour du différé). Écartée pour ce MVP : son délai de traitement (jusqu'à 24h) réintroduit une asynchronicité que le projet a déjà écartée pour l'ingestion CSV (abandon de Vercel Workflows). À reconsidérer si le volume de messages augmente significativement au point de justifier la complexité d'un cycle création-attente-récupération de batch.
- **Alternative envisagée et écartée** : un appel par message. Multiplierait le nombre d'appels HTTP et le coût pour un gain de fiabilité nul (le lot avec sortie structurée est tout aussi vérifiable message par message).
- **Modèle** : `claude-haiku-4-5` par défaut (tâche de classification simple, volumétrie potentiellement élevée → coût à optimiser), configurable via une variable d'environnement (`ANTHROPIC_SENTIMENT_MODEL`) pour permettre de basculer sur un modèle plus capable si l'échantillon de validation montre un taux d'accord insuffisant.
- Une invocation traite les lots les uns après les autres jusqu'à épuisement des messages en attente ou jusqu'à une limite de temps interne (garde-fou contre le timeout de la fonction serverless) ; les messages restants sont repris à la prochaine invocation, sans double traitement (mêmes garanties de reprise que l'ingestion CSV).

### Idempotence : statut par message, pas par run global
Colonnes ajoutées sur `messages` :
- `sentiment` (text, nullable) : sentiment recalculé (positif/négatif/neutre), rempli uniquement en cas de succès.
- `sentiment_status` (text, défaut `'pending'`) : `pending` / `completed` / `error`.
- `sentiment_error` (text, nullable) : détail de l'erreur si `sentiment_status = 'error'`.

Un message en erreur reste repris automatiquement à l'invocation suivante (pas de distinction "pending" vs "error" dans la requête de sélection des messages à traiter), pour rester cohérent avec le principe de reprise déjà en place sur l'ingestion. `sentiment_error` sert uniquement à la traçabilité/diagnostic (PRD section F).

Une table `sentiment_runs` (analogue à `import_runs`) trace chaque invocation : `id`, `started_at`, `finished_at`, `status` (`running`/`completed`/`error`), `processed_count`, `error_count`. Elle donne une visibilité opérationnelle sur les invocations successives, sans porter elle-même l'état de traitement (qui reste par message).

### Échantillon de validation : stratifié, annoté hors ligne via CSV
- Une table `sentiment_validation_runs` : `id`, `created_at`, `sample_size_per_class`, `status` (`sampled`/`annotated`), `agreement_rate` (nullable jusqu'à l'annotation).
- Une table `sentiment_validation_samples` : `id`, `validation_run_id`, `message_id`, `sentiment_ai` (snapshot au moment du tirage — le sentiment recalculé peut théoriquement être re-calculé plus tard, l'échantillon doit rester comparable à ce qui a été annoté), `sentiment_manual` (nullable jusqu'à réimport).
- Tirage : parmi les messages avec `sentiment_status = 'completed'`, tirage aléatoire d'au moins `sample_size_per_class` messages par classe (positif/négatif/neutre), défaut 30/classe (~90 messages) — configurable. Si une classe compte moins de messages complétés que la taille demandée, tous les messages de cette classe sont inclus (pas d'erreur bloquante) et ce sous-effectif est signalé dans la sortie de l'étape.
- Export : script Python générant un CSV (`id`, `text`, `sentiment_ai`, `sentiment_manual` vide) à partir d'un `validation_run_id`.
- Annotation : remplissage manuel de la colonne `sentiment_manual` dans le CSV exporté (valeurs attendues : `positif`/`négatif`/`neutre`).
- Réimport : script Python qui relit le CSV annoté, valide que `sentiment_manual` est renseigné avec une valeur des 3 classes attendues pour chaque ligne, écrit les valeurs en base (`sentiment_validation_samples.sentiment_manual`), calcule `agreement_rate` = (nombre de lignes où `sentiment_manual = sentiment_ai`) / (nombre total de lignes annotées), et met à jour `sentiment_validation_runs` (`status = 'annotated'`, `agreement_rate`).
- Le taux d'accord et le détail des désaccords (liste des messages où `sentiment_manual != sentiment_ai`) sont simplement consultables en base — aucune action automatique n'est déclenchée si `agreement_rate < 0.8`.

## Risks / Trade-offs

- [Le volume de messages dépasse ce qu'un traitement synchrone peut absorber en une invocation avant timeout serverless] → Le traitement par lots avec reprise (statut par message) permet d'étaler le travail sur plusieurs invocations sans perte ni double comptage ; à surveiller si le volume croît fortement (cf. alternative Message Batches API ci-dessus).
- [Le modèle par défaut (`claude-haiku-4-5`) n'atteint pas 80% d'accord sur l'échantillon] → Bascule vers un modèle plus capable via `ANTHROPIC_SENTIMENT_MODEL`, sans changement de schéma ni de code (juste une variable d'environnement), puis nouveau tirage de validation pour re-mesurer.
- [Le snapshot `sentiment_ai` dans l'échantillon devient incohérent si les messages sont reclassés après le tirage] → Le design accepte ce compromis : l'échantillon mesure la fiabilité du modèle *au moment du tirage*, pas en continu ; un nouveau tirage doit être relancé après tout changement de modèle/prompt pour re-valider.

## État de vérification (archivage 2026-08-03)

Ce change est archivé **sans avoir été exécuté contre l'API Anthropic réelle** : `ANTHROPIC_API_KEY` en local ne contient qu'une valeur placeholder, et l'utilisateur a choisi de ne pas engager de coût API pour l'instant. Ce qui a été vérifié :
- Tests unitaires (`pytest`, mocks du client Anthropic et de la connexion DB) : 45 passés.
- Migration Drizzle appliquée à la base Neon partagée (nouvelles colonnes/tables créées avec succès).
- Non-régression manuelle : écran `/import` et upload CSV toujours fonctionnels après la migration de schéma (vérifié par l'utilisateur en local).

Ce qui n'a **pas** été vérifié : le comportement réel de `classify_batch` face à l'API Anthropic (schéma de la réponse du tool use, respect du strict mode, qualité de classification), et donc tout le flux `POST /api/sentiment/runs` de bout en bout. À faire avant toute mise en production : configurer une vraie clé, lancer un run sur un petit échantillon de messages déjà importés, et vérifier manuellement quelques classifications avant de constituer un échantillon de validation.
