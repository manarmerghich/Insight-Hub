## 1. Bascule de `app/themes.py` vers Gemini

- [x] 1.1 Remplacer `anthropic.Anthropic` par `genai.Client` (découverte et classification)
- [x] 1.2 Remplacer `DISCOVER_TOOL` (tool use) par `DISCOVER_SCHEMA` (`response_json_schema`)
- [x] 1.3 Remplacer `build_classify_tool` (tool use) par `build_classify_schema` (`response_json_schema`)
- [x] 1.4 Ajouter la variable d'environnement `GEMINI_THEME_MODEL` (défaut `gemini-flash-lite-latest`)

## 2. Déclenchement automatique après import

- [x] 2.1 `run_theme_classification_step` accepte un paramètre `client` injectable
- [x] 2.2 `run_import_pipeline` accepte un paramètre `theme_client` et déclenche `run_theme_classification_step` après un import ayant inséré au moins un nouveau message
- [x] 2.3 Vérifier que l'échec de la classification de thème ne fait jamais échouer le run d'import

## 3. Nettoyage de la dépendance Anthropic

- [x] 3.1 Retirer `anthropic` de `pyproject.toml`
- [x] 3.2 Retirer `ANTHROPIC_API_KEY`/`ANTHROPIC_THEME_MODEL` de `.env.example`, ajouter `GEMINI_THEME_MODEL`

## 4. Tests

- [x] 4.1 Adapter les fakes de `tests/test_themes.py` et `tests/test_integration_themes.py` au client Gemini
- [x] 4.2 Couvrir le déclenchement automatique (et son absence) dans `tests/test_integration_workflows.py`
- [x] 4.3 Valider manuellement en conditions réelles (import via l'UI, classification de thème automatique, filtre dashboard par thème)
