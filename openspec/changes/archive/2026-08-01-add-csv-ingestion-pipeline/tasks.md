## 1. Schéma de données (Drizzle, côté `insight-hub-web`)

- [x] 1.1 Ajouter la table `import_runs` (id, mot-clé, nom du fichier source, statut, horodatages de début/fin, message d'erreur)
- [x] 1.2 Ajouter la table `messages` (run_id, source, collected_at, text, sentiment_original, timestamp, user, platform, hashtags, retweets, likes, country, keyword)
- [x] 1.3 Ajouter la contrainte `UNIQUE` de déduplication sur `messages` (platform, user, texte normalisé, timestamp)
- [x] 1.4 Générer et appliquer la migration Drizzle sur Neon (migration `insight-hub-web/drizzle/0000_greedy_kingpin.sql` appliquée avec succès via `npm run db:migrate` contre le vrai `DATABASE_URL` Neon ; tables `import_runs`/`messages` et contrainte `messages_dedup_key` confirmées présentes en interrogeant `information_schema` sur l'instance réelle)

## 2. Squelette du service `insight-hub-pipeline`

- [x] 2.1 Initialiser le projet Python (≥3.12, `uv`) avec la structure de fonctions serverless Vercel
- [x] 2.2 Configurer la connexion Neon (psycopg/SQLAlchemy Core) en lecture/écriture SQL simple
- [x] 2.3 Mettre en place l'authentification par bearer token partagé sur les routes entrantes

## 3. Réception du fichier CSV

- [x] 3.1 Créer la route d'import acceptant un fichier CSV + un mot-clé obligatoire
- [x] 3.2 Créer le run d'import (`import_runs`) à la réception de la requête
- [x] 3.3 Implémenter la bascule vers lecture Vercel Blob pour les fichiers dépassant 4.5 Mo
- [x] 3.4 Retourner une erreur explicite si le mot-clé est absent ou le fichier illisible

## 4. Étape de normalisation (step Vercel Workflow)

- [x] 4.1 Implémenter le nettoyage des espaces parasites sur `Text`, `Sentiment`, `User`, `Platform`, `Country`
- [x] 4.2 Implémenter le parsing homogène du champ `Timestamp`
- [x] 4.3 Valider la normalisation sur un échantillon du CSV de référence (`social-media-sentiments_analysis.csv`)

## 5. Étape de filtrage par mot-clé (step Vercel Workflow)

- [x] 5.1 Implémenter la recherche de sous-chaîne insensible à la casse sur le texte normalisé
- [x] 5.2 Exclure les messages ne correspondant pas au mot-clé du run
- [x] 5.3 Associer le mot-clé du run à chaque message retenu

## 6. Étape de déduplication et écriture (step Vercel Workflow)

- [x] 6.1 Calculer la clé de déduplication (platform, user, texte normalisé, timestamp) par ligne
- [x] 6.2 Insérer les messages retenus avec `ON CONFLICT DO NOTHING` sur la contrainte d'unicité
- [x] 6.3 Écrire la traçabilité (run_id, source, date de collecte) sur chaque message inséré
- [x] 6.4 Mettre à jour le statut du run (`terminé` + nombre de messages retenus, ou `erreur` + message)

## 7. Orchestration Vercel Workflows

- [x] 7.1 Définir le `@wf.workflow` enchaînant normalisation → filtrage → déduplication/écriture
- [x] 7.2 Définir chaque étape comme `@wf.step` retryable indépendamment
- [x] 7.3 Vérifier qu'un échec sur une étape ne réimporte pas les étapes déjà validées

## 8. Validation de bout en bout

- [x] 8.1 Exécuter un import complet du CSV de référence avec un mot-clé de test (automatisé dans `tests/test_integration_csv_ingestion.py` — conteneur Postgres éphémère via `testcontainers`, schéma appliqué depuis la migration Drizzle générée à la section 1 ; les 732 lignes du CSV de référence normalisées puis filtrées sur le mot-clé `day` → 46 messages insérés. Le déclenchement via `workflow.start()` reste non exercé : nécessite l'infrastructure Vercel Workflows, indisponible en local/CI)
- [x] 8.2 Vérifier l'absence de doublons et l'exactitude de la normalisation en base (assertions automatisées dans le même test d'intégration : 46 messages insérés = 46 clés de dédup distinctes, un run identique répété et un doublon intra-fichier injecté insèrent chacun 0 nouvelle ligne, 0 ligne avec espace parasite résiduel)
- [x] 8.3 Vérifier que le statut du run est consultable en base à chaque étape (en cours, terminé, erreur) (couvert par `test_replays_full_reference_csv_against_real_database` pour `running`/`completed` et `test_run_status_reflects_failure` pour `error`, tous deux dans la suite d'intégration)

## 9. Suite de tests automatisée (`pytest`)

- [x] 9.1 Tests unitaires `normalize.py` (`tests/test_normalize.py`) : espaces parasites, `None`/vide, timestamp homogène + format alternatif + timestamp invalide, conversion `retweets`/`likes`
- [x] 9.2 Tests unitaires `filtering.py` (`tests/test_filtering.py`) : correspondance insensible à la casse, absence de correspondance, mot-clé vide/`None`, texte vide
- [x] 9.3 Tests unitaires `dedup.py` (`tests/test_dedup.py`) : égalité/inégalité de la clé de dédup par champ, indépendance aux champs hors clé, `insert_messages` avec liste vide, ordre des paramètres SQL
- [x] 9.4 Test d'intégration (`tests/test_integration_csv_ingestion.py`, marqueur `integration`) rejouant les 732 lignes du CSV de référence contre un vrai Postgres (conteneur éphémère `testcontainers`, migration réelle appliquée, nettoyage automatique entre tests)
- [x] 9.5 Suite complète verte : `uv run pytest` → 39 passed (35 unitaires + 4 intégration)

## 10. Correctif : distinguer « aucune correspondance » de « déjà importé »

- [x] 10.1 Ajouter la colonne `matched_count` sur `import_runs` (migration `insight-hub-web/drizzle/0001_orange_zzzax.sql`, appliquée sur Neon), distincte de `retained_count`
- [x] 10.2 `dedup_and_write_step` retourne `matched_count` (nombre de messages filtrés, avant dédup) en plus de `inserted_count` ; `update_run_status` accepte et persiste `matched_count`
- [x] 10.3 Tests d'intégration mis à jour : `test_rerunning_the_same_import_inserts_no_new_rows_but_keeps_matched_count` vérifie explicitement que `matched_count` reste correct quand `retained_count` tombe à 0 après réimport (régression reproduisant le bug rapporté avec le mot-clé « fitness »)
