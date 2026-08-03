## 1. Schéma de données (`insight-hub-web`)

- [x] 1.1 Ajouter la table `themes` (id, label, description, created_at) dans `src/db/schema.ts`
- [x] 1.2 Ajouter la table `theme_runs` (id, status, started_at, finished_at, processed_count, error_count) dans `src/db/schema.ts`, miroir de `sentimentRuns`
- [x] 1.3 Ajouter les colonnes `theme_id` (FK nullable vers `themes.id`), `theme_status` (défaut `'pending'`) et `theme_error` sur `messages` dans `src/db/schema.ts`
- [x] 1.4 Générer la migration Drizzle (`drizzle-kit generate`) et vérifier le SQL généré

## 2. Découverte du référentiel de thèmes (`insight-hub-pipeline`)

- [x] 2.1 Créer `app/themes.py` avec les constantes (`THEME_DISCOVERY_SAMPLE_SIZE`, `BATCH_SIZE`, `TIME_BUDGET_SECONDS`, bornes 5-8) et le tool schema Anthropic de découverte (retourne 5 à 8 objets `{label, description}`)
- [x] 2.2 Implémenter `fetch_discovery_sample(conn, *, limit)` : échantillon aléatoire de messages déjà importés
- [x] 2.3 Implémenter `discover_themes(client, model, sample) -> list[dict]` : appel IA, validation 5-8 résultats exploitables
- [x] 2.4 Implémenter `themes_exist(conn) -> bool` et `insert_themes(conn, themes) -> None`
- [x] 2.5 Gérer l'échec de découverte : aucune ligne insérée si la réponse IA est invalide ou hors bornes 5-8

## 3. Classification de thème par message (`insight-hub-pipeline`)

- [x] 3.1 Implémenter `fetch_pending_messages(conn, *, limit)` (miroir de `sentiment.py`) filtrant `theme_status IN ('pending', 'error')`
- [x] 3.2 Implémenter `load_theme_labels(conn) -> dict[str, int]` (libellé → id), lu une fois par invocation
- [x] 3.3 Construire dynamiquement le tool schema de classification avec `enum` = libellés chargés
- [x] 3.4 Implémenter `classify_theme_batch(client, model, batch, theme_labels) -> dict[int, int]` (message id → theme id), en rejetant les libellés retournés hors référentiel
- [x] 3.5 Implémenter `write_batch_results(conn, batch, results)` : `theme_status = 'completed'` + `theme_id`, ou `theme_status = 'error'` + `theme_error`
- [x] 3.6 Implémenter `run_theme_classification(conn, *, deadline=None, client=None) -> dict` : bootstrap découverte si `themes` vide, puis boucle de lots resumable (miroir de `run_classification`)

## 4. Run tracking et orchestration

- [x] 4.1 Ajouter `create_theme_run` et `finalize_theme_run` dans `app/db.py` (miroir de `create_sentiment_run` / `finalize_sentiment_run`)
- [x] 4.2 Ajouter `run_theme_classification_step` dans `app/workflows.py` (miroir de `run_sentiment_classification`)
- [x] 4.3 Ajouter la route `POST /api/themes/runs` dans `api/index.py` (auth bearer token, appelle l'étape ci-dessus)

## 5. Restitution "top thèmes" (`insight-hub-web`)

- [x] 5.1 Implémenter une requête Drizzle de classement : group-by `theme_id` sur `messages` où `theme_status = 'completed'`, jointure `themes`, tri décroissant par nombre de messages, thèmes à 0 message inclus
- [x] 5.2 Exposer cette requête via une fonction serveur réutilisable (et une route API si besoin d'un appelant externe), sans page dashboard associée

## 6. Tests

- [x] 6.1 `tests/test_themes.py` : tests unitaires de `discover_themes`, `classify_theme_batch`, `write_batch_results`, mapping libellé → id, cas d'erreur (réponse IA invalide, libellé hors référentiel)
- [x] 6.2 `tests/test_integration_themes.py` : test d'intégration bout-en-bout (miroir de `test_integration_sentiment.py`) — bootstrap découverte sur base vide, puis classification resumable sur plusieurs invocations
- [x] 6.3 Test de la requête de classement (thèmes sans message inclus à 0, messages `pending`/`error` exclus) — `tests/test_integration_theme_ranking.py`, la requête SQL testée reproduit celle de la requête Drizzle (pas de runner JS configuré dans `insight-hub-web`)

## 7. Validation

- [x] 7.1 Faire tourner `openspec validate ai-theme-detection --strict` et corriger les éventuels écarts
- [x] 7.2 Exécuter la suite de tests pipeline (`pytest`) et vérifier qu'aucun test existant (sentiment, import) n'est cassé — 58 passed, 12 skipped (tests d'intégration nécessitant Docker, indisponible dans cet environnement — comportement pré-existant, cf. `requires_docker`)
