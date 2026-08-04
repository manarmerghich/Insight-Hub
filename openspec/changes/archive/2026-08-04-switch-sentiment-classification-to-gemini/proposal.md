## Why

L'utilisateur ne souhaite pas payer pour l'API Anthropic pendant cette phase du projet. L'API Gemini (aistudio.google.com) propose un palier gratuit permanent, sans carte bancaire, avec un quota (1500 requêtes/jour) largement suffisant pour le volume de messages traité ici. La capacité `ai-sentiment-analysis` reste le socle de tous les KPIs de sentiment du PRD ; seul le fournisseur IA change, la logique de classification (3 classes, sortie structurée, traitement par lot resumable, run tracking) reste identique.

## What Changes

- `insight-hub-pipeline/app/sentiment.py` utilise désormais le SDK `google-genai` (Gemini) au lieu du SDK `anthropic`, via sortie structurée JSON (`response_json_schema`) plutôt que le tool use Anthropic — même contrat observable (3 classes, un résultat par identifiant de message, mêmes valeurs stockées en base), donc pas de rupture pour les consommateurs de cette capacité.
- Nouvelle variable d'environnement `GEMINI_API_KEY` (remplace `ANTHROPIC_API_KEY` pour ce module précis) et `GEMINI_SENTIMENT_MODEL` (remplace `ANTHROPIC_SENTIMENT_MODEL`, défaut `gemini-2.5-flash-lite`).
- `app/themes.py` (détection de thèmes) continue d'utiliser le SDK Anthropic — hors périmètre de ce changement, `ANTHROPIC_API_KEY` reste nécessaire pour cette autre capacité.
- Correctif associé (découvert en vérifiant ce changement) : `insight-hub-web/src/db/net-sentiment-score.ts` filtrait le sentiment recalculé sur les valeurs anglaises `'positive'/'negative'/'neutral'`, alors que la colonne `messages.sentiment` contient les valeurs françaises `'positif'/'négatif'/'neutre'` (voir spec `ai-sentiment-analysis` et tests pipeline). Ce chemin de code était dormant (aucun message encore classé), mais serait resté silencieusement cassé dès l'activation de la classification. Corrigé pour utiliser les valeurs françaises.
- Nouveau comportement demandé par l'utilisateur : la classification de sentiment se déclenche désormais **automatiquement** juste après chaque import réussi ayant inséré au moins un nouveau message — plus besoin d'appeler manuellement `/api/sentiment/runs` après chaque import. Le dashboard, déjà rendu en lecture toujours fraîche, affiche donc le sentiment calculé dès la visite suivante sans action supplémentaire.

## Capabilities

### New Capabilities
(aucune)

### Modified Capabilities
- `ai-sentiment-analysis`: le Requirement "Sentiment Reclassification" ne mentionne plus un appel au SDK Anthropic spécifiquement, mais un appel à un SDK IA avec sortie structurée — le comportement observable (3 classes, un résultat par message, gestion d'erreur par message) est inchangé. Nouveau Requirement "Automatic Trigger After Import" : la classification se déclenche automatiquement après un import réussi avec de nouveaux messages, sans affecter le statut de l'import en cas d'échec.

## Impact

- `insight-hub-pipeline/app/sentiment.py` : remplacement complet de l'implémentation (SDK, schéma de sortie structurée, nom de modèle par défaut).
- `insight-hub-pipeline/pyproject.toml` : ajout de la dépendance `google-genai`, `anthropic` conservée (utilisée par `app/themes.py`).
- `insight-hub-pipeline/tests/test_sentiment.py`, `tests/test_integration_sentiment.py` : fakes adaptés à la forme du client Gemini (`client.models.generate_content` retournant `.text` JSON) au lieu du client Anthropic (`client.messages.create` retournant des blocks `tool_use`).
- `.env.example`, `insight-hub-pipeline/.env.local` : `GEMINI_API_KEY` / `GEMINI_SENTIMENT_MODEL` documentées et ajoutées.
- `insight-hub-web/src/db/net-sentiment-score.ts` : correction des valeurs de sentiment filtrées (anglais → français) dans le mode `"ai"` du score net (voir `NET_SENTIMENT_SOURCE` dans le changement `sentiment-and-distribution-dashboard`).
- `insight-hub-pipeline/app/workflows.py` : `run_import_pipeline` déclenche `run_sentiment_classification` quand `inserted_count > 0` ; les deux fonctions acceptent un client injectable pour les tests.
- `insight-hub-pipeline/tests/test_integration_workflows.py` (nouveau) : vérifie le déclenchement (et son absence) via une intégration réelle avec base de test.
