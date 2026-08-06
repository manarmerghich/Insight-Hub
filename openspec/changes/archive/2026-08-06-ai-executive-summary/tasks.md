## 1. Pipeline — génération Gemini (`insight-hub-pipeline/app/summary.py`)

- [x] 1.1 Créer `app/summary.py` avec `SUMMARY_SCHEMA` (`{"type": "object", "properties": {"summary": {"type": "string"}}, "required": ["summary"]}`) et `get_model()` lisant `GEMINI_SUMMARY_MODEL` (défaut `gemini-flash-lite-latest`, même pattern que `sentiment.py`/`themes.py`)
- [x] 1.2 Implémenter `build_prompt(kpis: dict) -> str` qui formate les KPIs reçus (score net + tendance, thème le plus à risque + tendance, répartition plateforme/pays, message représentatif) en texte, en n'incluant une comparaison que si elle est présente dans le payload (jamais inventée), et en demandant explicitement à Gemini de citer chiffres, comparaisons et exemples fournis
- [x] 1.3 Implémenter `generate_summary(client: genai.Client, model: str, kpis: dict) -> str` : appelle `client.models.generate_content` avec `response_mime_type`/`response_json_schema`, parse `response.text` en JSON, valide `summary` non vide, lève une exception sinon (capturée par l'appelant, même logique défensive que `discover_themes`)
- [x] 1.4 Implémenter `compute_scope_key(run_id, filters, classified_count) -> str` (empreinte déterministe du périmètre) et `find_cached_summary(conn, run_id, scope_key) -> str | None` (lecture de `executive_summaries`)
- [x] 1.5 Implémenter `write_summary(conn, run_id, scope_key, summary_text, model) -> None` (upsert dans `executive_summaries` sur la contrainte `unique(run_id, scope_key)`)
- [x] 1.6 Implémenter `run_summary_generation(run_id, filters, kpis, *, client=None) -> dict` orchestrant : lecture du cache, génération si absent, écriture du résultat, jamais d'exception non gérée (capture toute erreur et retourne `{"status": "error", "detail": ...}` plutôt que de lever)

## 2. Pipeline — endpoint HTTP (`insight-hub-pipeline/api/index.py`)

- [x] 2.1 Ajouter la route `POST /api/summary` (auth `verify_bearer_token`, même pattern que `/api/sentiment/runs`) acceptant en JSON `{run_id, filters, kpis}` et retournant `{"status": "ok", "summary": "...", "cached": bool}` ou `{"status": "error", "detail": "..."}`
- [x] 2.2 Valider les champs requis du corps de requête (400 si `run_id` ou `kpis` manquant), cohérent avec la validation déjà faite sur `/api/import`

## 3. Web — schéma et migration (`insight-hub-web/src/db`)

- [x] 3.1 Ajouter la table `executiveSummaries` dans `schema.ts` (`id`, `runId` références `importRuns.id`, `scopeKey`, `summaryText`, `model`, `createdAt`, contrainte `unique(runId, scopeKey)`)
- [x] 3.2 Générer et appliquer la migration Drizzle (`drizzle-kit generate` + `migrate`) — `drizzle/0005_numerous_warbound.sql` généré et appliqué avec succès sur Neon (vérifié : table `executive_summaries` présente avec les colonnes attendues)

## 4. Web — module de lecture/orchestration (`insight-hub-web/src/db/executive-summary.ts`)

- [x] 4.1 Implémenter `computeScopeKey(filters, classifiedCount)` côté web, symétrique à `compute_scope_key` côté pipeline (mêmes champs de filtre inclus : période, plateforme, pays, sentiment, thème — recherche et favoris exclus, cf. `dashboard-filters.ts`)
- [x] 4.2 Implémenter `getCachedExecutiveSummary(runId, scopeKey)` : lecture directe de `executiveSummaries` via Drizzle
- [x] 4.3 Implémenter `getExecutiveSummary(runId, filters, kpis)` : si cache trouvé le retourne directement (aucun appel pipeline) ; sinon appelle `POST /api/summary` (fetch avec timeout court, même pattern bearer que `import/actions.ts`) et retourne le texte reçu ou `null` en cas d'échec/timeout/réponse invalide (jamais d'exception qui remonte à `page.tsx`)
- [x] 4.4 Écrire `executive-summary.test.ts` : cache trouvé → pas d'appel HTTP, cache absent → appel HTTP puis retour du texte, échec HTTP/timeout → `null` sans exception, `computeScopeKey` stable pour des filtres équivalents et différent quand un filtre change

## 5. Web — composant dashboard (`insight-hub-web/src/app/dashboard/executive-summary-card.tsx`)

- [x] 5.1 Créer `ExecutiveSummaryCard` affichant le texte de synthèse dans une carte cohérente avec le style existant (`.card`, palette `globals.css`)
- [x] 5.2 État "résumé indisponible pour le moment" quand `getExecutiveSummary` retourne `null`, sans faire échouer le reste de la page
- [x] 5.3 État vide explicite quand aucun import n'a été réalisé (`latestRun` absent)

## 6. Intégration dashboard

- [x] 6.1 Dans `page.tsx`, après le `Promise.all` existant des KPIs rapides, rassembler le payload `kpis` nécessaire (score net + tendance, thème le plus à risque + tendance, répartitions, message représentatif) et appeler `getExecutiveSummary(runId, filters, kpis)` séparément (pas dans le même `Promise.all`, pour ne pas ralentir l'affichage des autres KPIs si la génération est lente)
- [x] 6.2 Insérer `ExecutiveSummaryCard` dans `page.tsx`, en tête de page (synthèse en premier, avant le détail des KPIs)

## 7. Specs et validation

- [x] 7.1 Lancer `openspec validate ai-executive-summary --strict` et corriger tout écart de format
- [x] 7.2 Lancer les tests pipeline (`pytest` dans `insight-hub-pipeline`) et web (`npm test` dans `insight-hub-web`), vérifier l'absence de régression sur les tests existants — 72 tests pytest (dont l'intégration, Docker disponible) et 91 tests vitest passent tous ; `tsc --noEmit` sans erreur
- [x] 7.3 Tester le dashboard avec Playwright : résumé affiché pour un import existant, changement de filtre déclenche un nouveau résumé, rechargement de page sans changement de filtre ne redéclenche pas d'appel Gemini (vérifiable via le réseau ou un compteur de mock), état "indisponible" simulé (ex. pipeline arrêté) sans casser le reste du dashboard, rendu responsive — vérifié en conditions réelles (dashboard `next dev` + pipeline `uvicorn` local contre Neon) : résumé généré et affiché pour l'import NIKE existant ; changement de filtre (`?platform=TikTok`) crée une 2e ligne `executive_summaries` distincte (scope_key différent) avec un texte différent ; rechargement identique et rechargement du même filtre ne créent aucune nouvelle ligne (compteur de lignes inchangé, temps de réponse ~1.5s vs ~4-6s en génération) ; pipeline arrêté (`?country=Japan`, scope inédit) → carte "Résumé indisponible pour le moment.", reste du dashboard intact (HTTP 200, aucune exception dans les logs) ; rendu responsive vérifié via Playwright/Chromium à 1440×900 et 390×844 (captures d'écran, pas de débordement horizontal)
