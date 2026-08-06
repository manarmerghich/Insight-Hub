## Context

Le dashboard (`insight-hub-web/src/app/dashboard/page.tsx`) calcule déjà tous les KPIs nécessaires à l'export enrichi et les restitue via des composants React DOM "use client" qui dessinent leurs graphiques en SVG fait-main (ex. `NetSentimentCard` → `EvolutionChart`, `DistributionCard` → barres CSS). Ces composants ne sont pas réutilisables tels quels pour le PDF : `@react-pdf/renderer` ne rend pas du DOM/CSS, il a son propre jeu de primitives (`Document`, `Page`, `View`, `Text`, `Svg`/`Path`/`Line`/`Circle`/`Rect`, mise en page en Yoga/flexbox) exécutées côté serveur (Node.js, pas Edge — le renderer Node importe `fs`/`Buffer`).

Ce changement ajoute donc une route serveur dédiée qui recalcule le rendu (pas les données : les fonctions `db/` existantes sont réutilisées telles quelles) sous forme de composants `@react-pdf/renderer` distincts.

## Goals / Non-Goals

**Goals:**
- Un bouton "Exporter en PDF" sur le dashboard déclenche le téléchargement d'un PDF reflétant exactement le scope de filtres actif à l'écran (mêmes `searchParams`).
- Le PDF contient : résumé exécutif IA, score de sentiment net (valeur + évolution journalière), répartitions par plateforme et par pays, liste des messages favoris du scope.
- Aucune nouvelle donnée calculée : le PDF lit les mêmes fonctions `db/` que le dashboard (`getExecutiveSummary`, `getNetSentimentScore`, `getDailyNetSentimentEvolution`, `getPlatformDistribution`, `getCountryDistribution`, `getMessageSearchResults` avec `favoritesOnly: true`).
- Génération synchrone dans la requête HTTP (pas de job asynchrone) — cohérent avec le volume de données déjà géré à l'affichage du dashboard.

**Non-Goals:**
- Pas d'export PDF "basique" séparé (tableau brut sans résumé/favoris) : hors du périmètre demandé, et le PRD ne le distingue plus une fois l'enrichi construit directement.
- Pas de personnalisation de la mise en page du PDF par l'utilisateur (thème, sélection de sections) — un seul gabarit fixe.
- Pas de génération asynchrone/mise en file d'attente ni d'envoi par email — le PRD exclut explicitement l'envoi automatique (section 1.5, "pas d'envoi automatique").
- Pas de nuage de mots, top thèmes, score de risque réputationnel ou carte géographique dans le PDF : le périmètre demandé se limite explicitement au résumé IA, aux favoris et aux graphiques de score de sentiment net et de répartitions.
- Pas de rendu via navigateur headless (Puppeteer/Playwright) : l'architecture impose `@react-pdf/renderer`, sans navigateur (voir ARCHITECTURE.md §Frontend).

## Decisions

### Route serveur dédiée `GET /api/export-pdf`, exécution Node.js
Une route Next.js (`app/api/export-pdf/route.ts`) reçoit les mêmes `searchParams` que `dashboard/page.tsx` (période, plateforme, pays, sentiment, thème), les parse avec la même logique (`parseDashboardFilters`, extraite et partagée), recalcule `runId` via `getLatestImportRun()`, puis appelle les fonctions `db/` déjà existantes en parallèle, construit le composant PDF et répond avec `renderToBuffer()` (`Content-Type: application/pdf`, `Content-Disposition: attachment`).

Alternative écartée : Server Action déclenchant un `<PDFDownloadLink>` côté client. Écartée parce que `@react-pdf/renderer` côté client alourdirait le bundle du dashboard (composants PDF + moteur de rendu embarqués dans le JS client) sans bénéfice, alors qu'une route serveur classique + lien `<a href="/api/export-pdf?...">` télécharge sans aucun JS supplémentaire côté client.

La route déclare `export const runtime = "nodejs"` (défaut, mais explicite) : le renderer Node de `@react-pdf/renderer` importe `fs`/`Buffer`, incompatibles avec l'Edge Runtime.

### Filtres partagés entre dashboard et export via extraction de `parseDashboardFilters`
`parseDashboardFilters` (actuellement interne à `dashboard/page.tsx`) est déplacée dans `db/dashboard-filters.ts` (où vivent déjà `DashboardFilters` et les autres helpers de filtre) pour être appelée identiquement par la page dashboard et par la route d'export — évite une divergence de parsing entre les deux entrées.

### Composants PDF dédiés, un module `pdf/` séparé des composants dashboard
Nouveau répertoire `insight-hub-web/src/app/dashboard/pdf/` contenant le `Document` racine (`ExportDocument.tsx`) et un composant par section (résumé, score net + évolution, répartitions, favoris). Les composants dashboard existants (`net-sentiment-card.tsx`, `distribution-card.tsx`, etc.) ne sont ni modifiés ni réutilisés comme JSX — seule la **logique de calcul des points du graphique** (échelle, positions) déjà écrite dans `net-sentiment-card.tsx` est extraite en fonction pure partagée (ex. `buildEvolutionPathPoints(evolution, width, height, padding)`) pour éviter de dupliquer la géométrie entre le rendu DOM et le rendu PDF, qui restent chacun responsables de leur propre balisage (`<svg><path>` vs `<Svg><Path>`).

Alternative écartée : essayer de faire tourner les composants dashboard existants tels quels dans `@react-pdf/renderer`. Rejetée — react-pdf ne connaît pas les balises DOM (`div`, `svg` natif) ni le CSS externe (`globals.css`), seulement ses propres primitives avec `StyleSheet.create`.

### Graphique d'évolution en `Svg`/`Path` avec la même géométrie que `EvolutionChart`
Le graphique de score net dans le PDF reprend les constantes `CHART_WIDTH`/`CHART_HEIGHT`/`CHART_PADDING` et l'algorithme de placement de points déjà validés dans `net-sentiment-card.tsx`, redessinés avec `<Svg><Path d={...} stroke="#2563EB" /></Svg>` (palette du projet). Pas de pics annotés dans le PDF (les pics sont une fonctionnalité d'exploration interactive du dashboard, pas retenue dans le périmètre demandé).

### Répartitions en barres `View` avec largeur en pourcentage
Les répartitions plateforme/pays reprennent le principe de `distribution-card.tsx` (barre horizontale dont la largeur = `entry.share * 100%`) mais avec des primitives `View` de `@react-pdf/renderer` (qui supportent les largeurs en pourcentage) plutôt que du CSS — rendu visuellement équivalent sans dépendance à une librairie de graphiques.

### Favoris : réutilisation de `getMessageSearchResults` avec `favoritesOnly: true`, plafonnés à `MESSAGE_SEARCH_RESULT_CAP`
Le PDF liste les favoris du scope actif via `getMessageSearchResults(runId, { ...filters, favoritesOnly: true })`, déjà scopé au dernier run et déjà plafonné à 50 résultats (voir `message-favorites`, Requirement "Favorites Scoped To Latest Import Run For Display"). Pas de requête dédiée : réutilisation à l'identique de la fonction qui alimente déjà le filtre "favoris uniquement" du dashboard.

### Résumé exécutif : lecture du cache existant, jamais de régénération dans la route d'export
La route appelle `getCachedExecutiveSummary(runId, scopeKey)` (lecture pure), jamais `getExecutiveSummary` avec génération IA — le résumé doit déjà avoir été calculé par le chargement du dashboard pour ce scope avant que l'export ne soit possible. Si aucun résumé n'est en cache pour ce `scopeKey` (ex. filtres jamais consultés à l'écran), le PDF affiche une mention "résumé indisponible pour ce scope" plutôt que de déclencher un appel IA synchrone dans le téléchargement.

Alternative écartée : appeler `getExecutiveSummary` (avec génération à la volée) depuis la route d'export. Rejetée — ajouterait une latence IA (jusqu'à 8s, voir `SUMMARY_FETCH_TIMEOUT_MS`) et un coût d'appel IA supplémentaire à une action de téléchargement, alors que l'utilisateur a presque toujours déjà chargé le dashboard sur ce même scope juste avant d'exporter (le bouton d'export vit sur cette même page).

## Risks / Trade-offs

- [Le résumé exécutif peut être absent du cache si l'utilisateur exporte un scope jamais affiché à l'écran (lien direct vers la route, scope reconstruit manuellement)] → Mitigation : dégradation gracieuse avec mention explicite dans le PDF, cohérente avec le principe déjà appliqué par `ExecutiveSummaryCard` sur le dashboard (pas d'erreur bloquante).
- [Duplication de la géométrie du graphique d'évolution entre DOM (`net-sentiment-card.tsx`) et PDF si l'extraction en fonction pure n'est pas correctement partagée] → Mitigation : extraire `buildEvolutionPathPoints` une seule fois dans un module commun (`db/` ou un nouveau `dashboard/chart-geometry.ts`) importé par les deux rendus, pas dupliqué.
- [Volume de messages favoris élevé pouvant alourdir un PDF déjà volumineux] → Mitigation : réutilisation du plafond `MESSAGE_SEARCH_RESULT_CAP` déjà en place, avec mention du troncage si `isTruncated`, cohérente avec le comportement déjà affiché par `MessageSearchResults` sur le dashboard.
- [`@react-pdf/renderer` est une dépendance nouvelle et relativement lourde (moteur de mise en page Yoga)] → Mitigation : usage strictement serveur (import uniquement dans la route `app/api/export-pdf/route.ts`, jamais dans un composant client), donc aucun impact sur le bundle JS envoyé au navigateur.

## Migration Plan

Ajout pur, aucune donnée existante à migrer :
1. Ajouter `@react-pdf/renderer` à `insight-hub-web/package.json`.
2. Extraire `parseDashboardFilters` vers `db/dashboard-filters.ts`.
3. Extraire la géométrie du graphique d'évolution en fonction pure partagée.
4. Construire les composants PDF (`pdf/ExportDocument.tsx` + sections).
5. Créer la route `app/api/export-pdf/route.ts`.
6. Ajouter le bouton/lien d'export sur `dashboard/page.tsx`.

Rollback : retrait de la route et du bouton, sans impact sur le reste du dashboard (aucun schéma de base modifié).

## Open Questions

Aucune à ce stade — le périmètre (sections incluses, filtres respectés, absence de génération IA synchrone) est fixé par les décisions ci-dessus.
