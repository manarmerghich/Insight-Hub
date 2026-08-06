## 1. Dépendances et partage des filtres

- [x] 1.1 Ajouter `@react-pdf/renderer` aux dépendances de `insight-hub-web/package.json` et installer.
- [x] 1.2 Extraire `parseDashboardFilters` (et ses helpers `first`/`parseDate`) de `dashboard/page.tsx` vers `db/dashboard-filters.ts`, réexportée et utilisée à l'identique par `dashboard/page.tsx`.
- [x] 1.3 Ajouter un test unitaire pour `parseDashboardFilters` (searchParams valides, invalides, absents) dans `db/dashboard-filters.test.ts`.

## 2. Géométrie de graphique partagée

- [x] 2.1 Extraire de `net-sentiment-card.tsx` la logique de calcul des points du graphique d'évolution (échelle, positions à partir de `CHART_WIDTH`/`CHART_HEIGHT`/`CHART_PADDING`) en fonction pure `buildEvolutionPathPoints` dans un module partagé (ex. `dashboard/chart-geometry.ts`).
- [x] 2.2 Faire consommer cette fonction par `EvolutionChart` (rendu DOM existant) sans changement de comportement visuel.
- [x] 2.3 Ajouter un test unitaire pour `buildEvolutionPathPoints` (série vide, un seul point, série multi-points).

## 3. Composants PDF

- [x] 3.1 Créer `dashboard/pdf/ExportDocument.tsx` : `Document`/`Page` racine avec `StyleSheet` reprenant la palette du projet (Primary #2563EB, etc.), structure en sections.
- [x] 3.2 Créer la section résumé exécutif : texte du résumé en cache, ou mention "résumé indisponible pour ce scope" si absent.
- [x] 3.3 Créer la section score de sentiment net : valeur + graphique d'évolution en `Svg`/`Path` réutilisant `buildEvolutionPathPoints`, ou mention d'absence de données si aucun message classé.
- [x] 3.4 Créer la section répartitions : barres `View` en pourcentage pour plateforme et pays, ou mention d'absence de données si le scope est vide.
- [x] 3.5 Créer la section favoris : liste des messages favoris (texte, auteur, plateforme, sentiment) issus de `getMessageSearchResults(runId, { ...filters, favoritesOnly: true })`, mention si tronquée (`isTruncated`), ou mention d'absence de favoris.

## 4. Route d'export

- [x] 4.1 Créer `app/api/export-pdf/route.ts` (`export const runtime = "nodejs"`) : parse les `searchParams` avec `parseDashboardFilters`, résout `runId` via `getLatestImportRun()`.
- [x] 4.2 Appeler en parallèle `getCachedExecutiveSummary` (avec le `scopeKey` calculé via `computeScopeKey`), `getNetSentimentScore`, `getDailyNetSentimentEvolution`, `getPlatformDistribution`, `getCountryDistribution`, `getMessageSearchResults` (favoris uniquement) — jamais `getExecutiveSummary` avec génération.
- [x] 4.3 Rendre `ExportDocument` via `renderToBuffer` et répondre avec `Content-Type: application/pdf` et `Content-Disposition: attachment; filename=...`.
- [x] 4.4 Gérer le cas `runId === null` (aucun import) : réponse d'erreur explicite plutôt qu'un PDF vide.

## 5. Intégration dashboard

- [x] 5.1 Ajouter un bouton/lien "Exporter en PDF" sur `dashboard/page.tsx`, construit à partir des `searchParams` actifs (`<a href="/api/export-pdf?...">`), désactivé/masqué si aucun import n'a été réalisé.
- [x] 5.2 Styler le bouton selon la charte du projet (Primary, états hover/active/focus/disabled) dans `globals.css`.

## 6. Vérification

- [x] 6.1 Lancer les tests unitaires (`npm test` dans `insight-hub-web`) et vérifier qu'ils passent.
- [x] 6.2 Vérifier avec Playwright que le bouton d'export déclenche bien le téléchargement d'un PDF, avec et sans filtres actifs, et que l'interface reste responsive.
- [x] 6.3 Ouvrir le PDF généré et vérifier visuellement la présence et l'exactitude des quatre sections (résumé, score net + évolution, répartitions, favoris) face au contenu affiché sur le dashboard pour le même scope.
