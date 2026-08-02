## 1. Scaffolding Next.js `insight-hub-web`

- [x] 1.1 Initialiser l'application Next.js (App Router, TypeScript) dans `insight-hub-web`, en conservant `drizzle.config.ts` et `src/db/schema.ts` existants
- [x] 1.2 Ajouter la dépendance `@vercel/blob`, sans introduire de bibliothèque de composants UI
- [x] 1.3 Créer la route `/import` (page + layout minimal, style clair et minimaliste)

## 2. Formulaire d'upload (mot-clé + fichier)

- [x] 2.1 Créer le composant de formulaire : champ mot-clé obligatoire + champ de sélection de fichier CSV
- [x] 2.2 Valider côté client l'absence de mot-clé ou de fichier avant tout appel réseau (bloque la soumission, affiche l'erreur)
- [x] 2.3 Détecter la taille du fichier sélectionné (seuil 4.5 Mo) pour choisir le chemin d'upload

## 3. Soumission directe pour les petits fichiers (< 4.5 Mo)

- [x] 3.1 Implémenter la Server Action de soumission (mot-clé + fichier), exécutée uniquement côté serveur
- [x] 3.2 Relayer la requête vers `insight-hub-pipeline` (`PIPELINE_SERVICE_URL` + `PIPELINE_AUTH_TOKEN`, jamais exposés au client)
- [x] 3.3 Retourner l'identifiant du run créé au composant client pour démarrer le suivi de statut

## 4. Bascule Vercel Blob pour les gros fichiers (≥ 4.5 Mo)

- [x] 4.1 Créer la Route Handler serveur `handleUpload` générant un jeton Blob à usage unique
- [x] 4.2 Implémenter l'upload direct navigateur → Vercel Blob avec `@vercel/blob/client`
- [x] 4.3 Transmettre uniquement l'URL Blob obtenue à la Server Action pour déclencher le run

## 5. Gestion des erreurs de soumission

- [x] 5.1 Afficher le message d'erreur retourné par le pipeline (mot-clé absent, fichier illisible)
- [x] 5.2 Afficher un message d'erreur générique en cas d'échec réseau (pipeline injoignable)

## 6. Affichage du statut du run

- [x] 6.1 Implémenter la lecture du statut du run via Drizzle (table `import_runs`) depuis `insight-hub-web`
- [x] 6.2 Implémenter le polling à intervalle fixe (2 s) tant que le statut n'est pas terminal
- [x] 6.3 Afficher l'état « en cours » pendant le traitement
- [x] 6.4 Afficher le nombre de messages retenus et arrêter le polling si le run est terminé
- [x] 6.5 Afficher le message d'erreur et arrêter le polling si le run est en erreur

## 7. Validation

- [x] 7.1 Tester manuellement l'écran avec un import de petite taille (< 4.5 Mo) et un mot-clé de test, en conditions réelles (Neon réel, `insight-hub-pipeline` lancé localement via `uvicorn`). Le déclenchement réel de `workflow.start()` a nécessité un double de test in-process (mêmes fonctions `normalize`/`filter`/`insert_messages`/`update_run_status` déjà testées, sans passer par l'infrastructure Vercel Workflows) : `workflow.start()` exige un token OIDC et un contexte de projet Vercel introuvables en local, blocage déjà documenté dans `add-csv-ingestion-pipeline`. Résultat : run créé, statut « en cours » puis « terminé » avec 46 messages retenus, cohérent avec la validation précédente sur ce même CSV/mot-clé.
- [ ] 7.2 Tester manuellement la bascule Vercel Blob avec un fichier ≥ 4.5 Mo (bloqué : `BLOB_READ_WRITE_TOKEN` dans `.env.local` est toujours le placeholder de `.env.example`, et Vercel Blob n'a pas d'émulateur local — non testable sans un vrai store Blob)
- [x] 7.3 Test Playwright de bout en bout : validation client (mot-clé manquant → aucun appel réseau), soumission réussie → statut « en cours » puis « terminé » (46 messages, arrêt confirmé du polling après 5 s d'observation), erreur pipeline affichée (500 réel), erreur réseau affichée (pipeline arrêté), écran vérifié responsive à 390×844 et 1280×800

## 8. Correctif : affichage ambigu « 0 message(s) retenu(s) »

- [x] 8.1 Bug rapporté : réimport du CSV de référence avec le mot-clé « fitness » affiche « 0 message(s) retenu(s) » alors que le mot-clé correspond bien à 5 messages du `Text` — diagnostiqué comme la déduplication fonctionnant normalement (les 5 messages avaient déjà été insérés lors d'un run précédent), pas un bug de filtrage
- [x] 8.2 `getRunStatus` retourne désormais `matchedCount` en plus de `retainedCount` (colonne `matched_count` ajoutée côté `insight-hub-pipeline`, cf. `add-csv-ingestion-pipeline` tâche 10.1)
- [x] 8.3 `RunStatus` distingue à l'affichage : aucune correspondance, messages retenus normalement, messages correspondant mais déjà tous importés, et cas partiel
- [x] 8.4 Correctif validé par la suite de tests pipeline (`uv run pytest` → 39 passed, incluant la régression `test_rerunning_the_same_import_inserts_no_new_rows_but_keeps_matched_count`) et confirmé fonctionnel par l'utilisateur en conditions réelles
