## 1. Dépendances et configuration

- [x] 1.1 Ajouter `google-genai` aux dépendances de `insight-hub-pipeline` (`uv add google-genai`), conserver `anthropic` (utilisée par `app/themes.py`)
- [x] 1.2 Documenter `GEMINI_API_KEY` et `GEMINI_SENTIMENT_MODEL` dans `.env.example`, ajouter `GEMINI_API_KEY` à `insight-hub-pipeline/.env.local` (clé réelle fournie par l'utilisateur)

## 2. Implémentation `sentiment.py`

- [x] 2.1 Remplacer l'import `anthropic` par `from google import genai`, remplacer `CLASSIFY_TOOL` (tool use Anthropic) par `CLASSIFY_SCHEMA` (JSON Schema pour `response_json_schema`)
- [x] 2.2 Réécrire `classify_batch` pour appeler `client.models.generate_content(model=..., contents=..., config={"response_mime_type": "application/json", "response_json_schema": CLASSIFY_SCHEMA})`, parser `response.text` en JSON, et garder la validation par appartenance à `VALID_SENTIMENTS`
- [x] 2.3 Mettre à jour `get_model()` pour lire `GEMINI_SENTIMENT_MODEL` (défaut `gemini-flash-lite-latest` — voir 3.4, `gemini-2.5-flash-lite` épinglé est rejeté par l'API pour les clés récentes)
- [x] 2.4 Mettre à jour `run_classification` pour instancier `genai.Client()` par défaut au lieu de `anthropic.Anthropic()` ; `fetch_pending_messages` et `write_batch_results` restent inchangées (aucune dépendance au SDK IA)

## 3. Tests

- [x] 3.1 Adapter `tests/test_sentiment.py` : fakes `FakeClient`/`FakeModels` imitant `client.models.generate_content(...)` retournant un objet avec `.text` (JSON), au lieu des blocks `tool_use` Anthropic
- [x] 3.2 Adapter `tests/test_integration_sentiment.py` (même changement de forme de fake, y compris le compteur d'appels `client.models.call_count`)
- [x] 3.3 Lancer la suite complète (`pytest -m "not integration"` puis `pytest -m integration`, Docker requis) : 58 tests unitaires + 2 tests d'intégration sentiment passent, `themes.py`/Anthropic non affectés

## 4. Correctif collatéral découvert pendant la vérification

- [x] 4.1 Corriger `insight-hub-web/src/db/net-sentiment-score.ts` (mode `"ai"` de `NET_SENTIMENT_SOURCE`) : filtrer sur `'positif'/'négatif'/'neutre'` au lieu de `'positive'/'negative'/'neutral'`, pour que la bascule future vers l'IA fonctionne réellement

## 5. Vérification avec la vraie clé Gemini de l'utilisateur (pas de mock)

- [x] 5.1 Exécuter `classify_batch` avec un vrai `genai.Client()` sur 5 messages `pending` réels de la base — `gemini-2.5-flash-lite` (défaut initial) rejeté en `404 NOT_FOUND` ("no longer available to new users") malgré sa présence dans `client.models.list()`
- [x] 5.2 Basculer vers `gemini-flash-lite-latest`, corriger le défaut dans `get_model()` et `.env.example` en conséquence
- [x] 5.3 Ré-exécuter sur deux lots de 5 messages réels : 10/10 classés sans erreur, les 3 classes (positif/négatif/neutre) observées avec des résultats cohérents au contenu ; résultats persistés et relus en base pour confirmation
- [x] 5.4 Relancer `pytest tests/test_sentiment.py tests/test_integration_sentiment.py` après le changement de modèle par défaut : 8/8 passent (le nom de modèle n'affecte pas les fakes)

## 6. Déclenchement automatique après import

- [x] 6.1 Ajouter un paramètre `sentiment_client=None` à `run_import_pipeline` ; appeler `run_sentiment_classification(client=sentiment_client)` juste après `finalize_success_step` quand `result["inserted_count"] > 0`
- [x] 6.2 Ajouter un paramètre `client=None` à `run_sentiment_classification`, threadé vers `run_classification(conn, client=client)`
- [x] 6.3 Créer `tests/test_integration_workflows.py` : un test confirme le déclenchement (nouveau message → classification appelée, résultat persisté) et un test confirme l'absence de déclenchement (import sans nouveau message → aucun appel)
- [x] 6.4 Lancer la suite complète : 72/72 tests passent (70 précédents + 2 nouveaux)
- [x] 6.5 Vérification live réelle (pas de mock) : import du mot-clé `sunset` via l'UI web (`/import`), 9 nouveaux messages, classification automatique déclenchée ~1s après la fin de l'import, terminée en ~3s, `processed_count=9, error_count=0`, aucune action manuelle
- [x] 6.6 Bug opérationnel trouvé et corrigé pendant la vérification live : le serveur `uvicorn --reload` tournait depuis avant l'ajout de `GEMINI_API_KEY` à `.env.local` et ne l'a jamais chargée (l'app ne relit pas `.env.local` elle-même) — redémarré avec `--env-file .env.local` ; confirmé par un nouveau run de classification réussi (68 messages traités, 0 erreur)
