## 1. Schéma et migration (Drizzle, `insight-hub-web`)

- [x] 1.1 Ajouter `visitorId: text("visitor_id").notNull()` à `importRuns` dans `insight-hub-web/src/db/schema.ts`, avec un index btree (`index("import_runs_visitor_id_idx").on(table.visitorId)`)
- [x] 1.2 Générer la migration Drizzle (`npm run db:generate` ou équivalent) en deux temps : `ADD COLUMN ... DEFAULT 'legacy-shared'` puis `DROP DEFAULT`, pour que les lignes existantes (normalement aucune, base déjà purgée) soient rattachées à une valeur sentinelle plutôt que de bloquer la migration
- [x] 1.3 Appliquer la migration sur Neon (`npm run db:migrate`) et vérifier que la colonne et l'index existent bien

## 2. Attribution de l'identifiant de session (`insight-hub-web`)

- [x] 2.1 Créer `insight-hub-web/src/middleware.ts` : si le cookie de session (ex. `ih_vid`) est absent, générer un `crypto.randomUUID()`, le poser sur `request.cookies` (pour que la requête en cours voie déjà la valeur) et sur la réponse (`NextResponse.next({ request: { headers: request.headers } })` + `response.cookies.set(...)`), avec `httpOnly`, `secure`, `sameSite: "lax"`, expiration ~1 an ; matcher toutes les routes de page (exclure les assets statiques)
- [x] 2.2 Créer un helper serveur `getCurrentVisitorId()` (ex. `insight-hub-web/src/lib/visitor.ts`) qui lit le cookie via `cookies()` (`next/headers`) et le retourne — utilisé par toutes les Server Components/Actions/Route Handlers ci-dessous ; lève une erreur explicite s'il est appelé sans cookie présent (ne devrait jamais arriver après 2.1, sert de garde-fou)
- [x] 2.3 Écrire un test (ou vérification manuelle documentée) confirmant qu'une requête sans cookie reçoit bien un cookie en réponse, et qu'une requête avec cookie existant le conserve inchangé

## 3. Pipeline Python (`insight-hub-pipeline`)

- [x] 3.1 Ajouter le paramètre `visitor_id: str = Form(...)` à `POST /api/import` dans `insight-hub-pipeline/api/index.py`, avec la même validation "obligatoire" que `keyword` (400 si absent/vide)
- [x] 3.2 Modifier `create_import_run` dans `insight-hub-pipeline/app/db.py` pour accepter et écrire `visitor_id` dans l'`INSERT INTO import_runs`
- [x] 3.3 Propager `visitor_id` à travers `run_import_pipeline` (`app/workflows.py`) si nécessaire pour la traçabilité des logs, sans changer la logique de classification sentiment/thème (celle-ci reste globale par message, non scopée par visiteur — voir design.md, `messages` n'a pas de colonne visiteur)
- [x] 3.4 Adapter/ajouter les tests Python (`tests/`) couvrant : import avec `visitor_id` fourni, import refusé si `visitor_id` manquant

## 4. Propagation depuis l'action d'import (`insight-hub-web`)

- [x] 4.1 Dans `insight-hub-web/src/app/import/actions.ts`, appeler `getCurrentVisitorId()` et ajouter `visitor_id` au `FormData` envoyé à `POST /api/import` dans `callPipelineImport` (`submitDirectImport` et `submitBlobImport`)
- [x] 4.2 Vérifier que la page `/import` (Server Component) n'a besoin d'aucun changement direct — seule l'action serveur a besoin du visiteur courant

## 5. Scoping des résolveurs de lecture (`insight-hub-web`)

- [x] 5.1 `insight-hub-web/src/db/latest-import-run.ts` : `getLatestImportRun(visitorId: string)` — ajouter `WHERE import_runs.visitor_id = visitorId` à la requête existante
- [x] 5.2 `insight-hub-web/src/db/dashboard-filter-options.ts` : `getDashboardFilterOptions(runId, visitorId)` (ou dérivé transitivement via `runId` déjà scopé — vérifier si cette fonction interroge directement `import_runs` ou seulement `messages` via `runId`, et scoper seulement si nécessaire)
- [x] 5.3 `insight-hub-web/src/db/keyword-comparison.ts` : `getComparableKeywords(excludeKeyword, visitorId)` et `getLatestRunIdForKeyword(keyword, visitorId)` — ajouter le filtre visiteur à chacune (voir spec `keyword-comparison`, Requirement "Comparable Keyword Selection" modifié)
- [x] 5.4 `insight-hub-web/src/app/dashboard/page.tsx` : appeler `getCurrentVisitorId()` une fois en haut de la Server Component et le propager à tous les appels de 5.1–5.3
- [x] 5.5 `insight-hub-web/src/app/api/export-pdf/route.tsx` : lire le visiteur courant (via `cookies()`, disponible dans un Route Handler) avant d'appeler `getLatestImportRun`, et le propager
- [x] 5.6 Vérifier chaque autre fonction de `src/db/*.ts` qui prend déjà un `runId` en paramètre (net-sentiment-score, engagement-rate, theme-ranking, message-search, message-favorites, sentiment-word-cloud, representative-messages, theme-risk-score, executive-summary…) : confirmer qu'aucune ne résout elle-même un run "global" en interne — elles doivent rester de simples fonctions de `runId`, le scoping visiteur se faisant uniquement au niveau de 5.1–5.5 (pas de duplication du filtre visiteur partout)

## 6. Nettoyage et vérification

- [x] 6.1 Mettre à jour `README.md` / `.env.example` si une nouvelle variable d'environnement est introduite (ex. nom du cookie, durée de vie) — sinon, confirmer qu'aucune variable n'est nécessaire (génération côté code uniquement)
- [x] 6.2 Lancer la suite de tests existante (`insight-hub-web` : `npm test` ; `insight-hub-pipeline` : `uv run pytest -m "not integration"`) et vérifier qu'aucune régression n'apparaît sur les fonctions modifiées
- [x] 6.3 Test manuel Playwright : ouvrir l'app dans deux contextes de navigateur isolés (ex. deux profils/`storageState` différents), importer un mot-clé distinct dans chacun, et confirmer qu'aucun des deux ne voit les données de l'autre (dashboard, sélecteur de comparaison, recherche, export PDF)
- [x] 6.4 Test manuel : ouvrir l'app dans un navigateur n'ayant jamais visité l'app (ou après suppression des cookies) et confirmer un dashboard entièrement vide dès la première visite, sans étape de configuration
- [x] 6.5 Déployer dans l'ordre décrit en design.md (migration DB → `insight-hub-pipeline` → `insight-hub-web`) et revérifier le point 6.3/6.4 en production

## 7. Correctif : déduplication scopée par visiteur (bug trouvé en vérification)

- [x] 7.1 Ajouter `visitorId: text("visitor_id").notNull()` à `messages` dans `schema.ts`, remplacer `messages_dedup_key` par `unique(...).on(table.visitorId, table.platform, table.user, table.text, table.timestamp)`
- [x] 7.2 Générer + adapter la migration Drizzle : `ADD COLUMN visitor_id text` (nullable), backfill réel `UPDATE messages SET visitor_id = import_runs.visitor_id FROM import_runs WHERE messages.run_id = import_runs.id`, puis `SET NOT NULL`, puis migration de la contrainte unique
- [x] 7.3 Appliquer la migration sur Neon et vérifier la contrainte + le backfill
- [x] 7.4 `insight-hub-pipeline/app/dedup.py` : ajouter `visitor_id` à `INSERT_COLUMNS`, au `ON CONFLICT`, et à la signature de `insert_messages`/`dedup_key`
- [x] 7.5 `insight-hub-pipeline/app/workflows.py` : ajouter `visitor_id` à `dedup_and_write_step` et `run_import_pipeline`
- [x] 7.6 `insight-hub-pipeline/api/index.py` : propager `visitor_id` à l'appel de `run_import_pipeline`
- [x] 7.7 Mettre à jour les tests existants (`test_dedup.py`, `test_integration_csv_ingestion.py`, `test_integration_workflows.py`) pour les nouvelles signatures ; ajouter un test couvrant explicitement le scénario du bug (même fichier importé par deux visiteurs différents → les deux conservent leurs messages)
- [x] 7.8 Relancer toute la suite de tests (web + pipeline, y compris intégration) et redéployer dans le même ordre (DB → pipeline → web) ; revérifier en production avec deux visiteurs important le même contenu
