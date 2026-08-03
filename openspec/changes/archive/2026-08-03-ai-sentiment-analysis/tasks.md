## 1. Schéma (Drizzle, `insight-hub-web`)

- [x] 1.1 Ajouter à `messages` les colonnes `sentiment` (text, nullable), `sentiment_status` (text, défaut `'pending'`), `sentiment_error` (text, nullable)
- [x] 1.2 Créer la table `sentiment_runs` (`id`, `started_at`, `finished_at`, `status`, `processed_count`, `error_count`)
- [x] 1.3 Créer la table `sentiment_validation_runs` (`id`, `created_at`, `sample_size_per_class`, `status`, `agreement_rate`)
- [x] 1.4 Créer la table `sentiment_validation_samples` (`id`, `validation_run_id` → `sentiment_validation_runs.id`, `message_id` → `messages.id`, `sentiment_ai`, `sentiment_manual` nullable)
- [x] 1.5 Générer et appliquer la migration `drizzle-kit`

## 2. Dépendances (`insight-hub-pipeline`)

- [x] 2.1 Ajouter `anthropic` aux dépendances de `pyproject.toml`
- [x] 2.2 Vérifier la présence de `ANTHROPIC_API_KEY` en local (`.env`) et documenter `ANTHROPIC_SENTIMENT_MODEL` (optionnel, défaut `claude-haiku-4-5`) dans `.env.example`

## 3. Classification de sentiment (capability `ai-sentiment-analysis`)

- [x] 3.1 `app/sentiment.py` : requête SQL sélectionnant les messages `sentiment_status IN ('pending', 'error')`, découpés en lots (défaut 25)
- [x] 3.2 `app/sentiment.py` : construction de l'appel `messages.create` par lot avec tool use en mode strict (schéma `{"results": [{"id": int, "sentiment": "positif"|"négatif"|"neutre"}]}`), modèle lu depuis `ANTHROPIC_SENTIMENT_MODEL`
- [x] 3.3 `app/sentiment.py` : écriture des résultats par message (`sentiment`, `sentiment_status = 'completed'`) et gestion des messages en erreur (`sentiment_status = 'error'`, `sentiment_error` rempli) sans interrompre le lot
- [x] 3.4 `app/sentiment.py` : boucle sur les lots jusqu'à épuisement des messages en attente ou limite de temps interne, avec arrêt propre (les messages restants gardent `sentiment_status = 'pending'`)
- [x] 3.5 `app/db.py` : fonctions de création/mise à jour d'un `sentiment_runs` (statut, compteurs traités/erreur)
- [x] 3.6 `app/workflows.py` : fonction `run_sentiment_classification()` orchestrant 3.1–3.5, appelée depuis une nouvelle route
- [x] 3.7 `api/index.py` : route `POST /api/sentiment/runs` (authentifiée par bearer token) déclenchant `run_sentiment_classification()` et retournant le run créé
- [x] 3.8 Tests unitaires (`tests/test_sentiment.py`) : idempotence (message déjà `completed` non resoumis), gestion d'un message en erreur sans bloquer le lot, préservation de `sentiment_original`
- [x] 3.9 Test d'intégration (`tests/test_integration_sentiment.py`, marqueur `integration`) : reprise sur deux invocations successives sans double comptage

## 4. Échantillon de validation (capability `sentiment-validation-sample`)

- [x] 4.1 `app/validation_sample.py` : tirage stratifié par classe parmi les messages `sentiment_status = 'completed'` (taille par classe paramétrable, défaut 30), signalement des classes sous-représentées
- [x] 4.2 `app/validation_sample.py` : écriture du tirage dans `sentiment_validation_runs` + `sentiment_validation_samples` (snapshot de `sentiment_ai`)
- [x] 4.3 `scripts/export_validation_sample.py` : script CLI générant le CSV (`id`, `text`, `sentiment_ai`, `sentiment_manual` vide) à partir d'un `validation_run_id`
- [x] 4.4 `scripts/import_validation_annotations.py` : script CLI réimportant le CSV annoté, validant que `sentiment_manual` appartient à {positif, négatif, neutre} pour chaque ligne enregistrée, rejetant les lignes invalides sans bloquer les autres
- [x] 4.5 `scripts/import_validation_annotations.py` : calcul et écriture de `agreement_rate` sur `sentiment_validation_runs` (proportion d'accord `sentiment_manual` / `sentiment_ai`), passage de `status` à `'annotated'`
- [x] 4.6 Tests unitaires (`tests/test_validation_sample.py`) : tirage équilibré, classe sous-représentée, rejet d'une annotation invalide au réimport, calcul du taux d'accord (y compris cas < 80%, sans blocage)

## 5. Vérification

- [x] 5.1 `openspec validate ai-sentiment-analysis --strict`
- [x] 5.2 Exécuter la suite de tests Python (`pytest`) côté `insight-hub-pipeline`
