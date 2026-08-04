## Why

Le changement précédent (`switch-sentiment-classification-to-gemini`) a basculé uniquement le sentiment sur Gemini pour éviter les coûts de l'API Anthropic, en laissant explicitement `app/themes.py` sur Anthropic. Ce choix rendait la dépendance `anthropic` toujours nécessaire pour la seule capacité `ai-theme-detection`, alors que le même palier gratuit Gemini couvre aussi bien ce cas d'usage (sortie structurée JSON, mêmes contraintes de volume). Poursuivre la bascule sur les thèmes permet de retirer entièrement la dépendance Anthropic du pipeline. Par ailleurs, la classification de thème nécessitait encore un appel manuel après chaque import, alors que le sentiment se déclenche déjà automatiquement — cette asymétrie n'a plus de raison d'être une fois l'infrastructure de déclenchement automatique en place.

## What Changes

- `app/themes.py` utilise désormais le SDK `google-genai` (Gemini) au lieu du SDK `anthropic`, via sortie structurée JSON (`response_json_schema`) plutôt que le tool use Anthropic — même contrat observable (5 à 8 thèmes découverts, un thème assigné par message, mêmes valeurs stockées en base).
- Nouvelle variable d'environnement `GEMINI_THEME_MODEL` (remplace `ANTHROPIC_THEME_MODEL`, défaut `gemini-flash-lite-latest`).
- **BREAKING** (dépendance interne) : la dépendance `anthropic` est entièrement retirée de `pyproject.toml` — plus aucun module du pipeline ne l'utilise, `google-genai` couvre désormais sentiment et thèmes.
- Nouveau comportement demandé par l'utilisateur : la classification de thème se déclenche désormais **automatiquement** juste après chaque import réussi ayant inséré au moins un nouveau message, dans la foulée de la classification de sentiment déjà auto-déclenchée — plus besoin d'appeler manuellement la classification de thèmes après un import.

## Capabilities

### New Capabilities
(aucune)

### Modified Capabilities
- `ai-theme-detection` : les Requirements "Theme Taxonomy Discovery" et "Message Theme Classification" ne mentionnent plus un appel au SDK Anthropic spécifiquement, mais un appel à un SDK IA avec sortie structurée — le comportement observable (5 à 8 thèmes, un thème par message, gestion d'erreur par message) est inchangé. Nouveau Requirement "Automatic Trigger After Import" : la classification de thème se déclenche automatiquement après un import réussi avec de nouveaux messages, sans affecter le statut de l'import en cas d'échec.

## Impact

- `insight-hub-pipeline/app/themes.py` : remplacement complet de l'implémentation (SDK, schéma de sortie structurée, nom de modèle par défaut).
- `insight-hub-pipeline/pyproject.toml` : suppression de la dépendance `anthropic`.
- `insight-hub-pipeline/app/workflows.py` : `run_import_pipeline` déclenche `run_theme_classification_step` quand `inserted_count > 0`, juste après la classification de sentiment ; `run_theme_classification_step` et `run_import_pipeline` acceptent un `theme_client` injectable pour les tests.
- `insight-hub-pipeline/tests/test_themes.py`, `tests/test_integration_themes.py` : fakes adaptés à la forme du client Gemini (`client.models.generate_content` retournant `.text` JSON) au lieu du client Anthropic (`client.messages.create` retournant des blocks `tool_use`).
- `insight-hub-pipeline/tests/test_integration_workflows.py` : vérifie le déclenchement automatique de la classification de thème après import (et son absence), en plus du déclenchement de sentiment déjà couvert.
- `.env.example` : `GEMINI_THEME_MODEL` documentée et ajoutée, `ANTHROPIC_API_KEY` retirée (plus aucun module ne le nécessite).
