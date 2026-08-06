## Context

Le dashboard (`insight-hub-web/src/app/dashboard/page.tsx`) scope aujourd'hui tous ses KPIs au seul `runId` du dernier run d'import (`getLatestImportRun`), passé explicitement à chaque fonction de lecture (`getNetSentimentScore`, `getPlatformDistribution`, `getCountryDistribution`, `getThemeRanking`, etc. — toutes déjà paramétrées par `runId: number | null` + `filters: DashboardFilters`). Le PRD prévoit la comparaison à deux mots-clés comme cas d'usage ; cette fonctionnalité ajoute un second `runId` — résolu à partir d'un mot-clé choisi par l'utilisateur — et réutilise ces mêmes fonctions sans les modifier.

Trois décisions produit ont été validées avec l'utilisateur avant ce design :
- Les filtres croisés actifs (période, plateforme, pays, sentiment, thème) s'appliquent identiquement aux deux côtés de la comparaison.
- La sélection se fait par mot-clé (pas par run précis) ; le mot-clé résout vers son run le plus récent ayant des messages.
- Seuls les KPIs ponctuels sont comparés (score net courant, répartitions, thèmes) — pas la courbe d'évolution temporelle.

## Goals / Non-Goals

**Goals:**
- Permettre de choisir, sur le dashboard, un second mot-clé parmi ceux déjà importés, et afficher côte à côte avec le run courant : score de sentiment net, répartition par plateforme, répartition par pays, classement des thèmes.
- Réutiliser à l'identique les fonctions de lecture existantes (`net-sentiment-score.ts`, `message-distribution.ts`, `theme-ranking.ts`) : aucun nouveau calcul agrégé indépendant, aucun appel IA.
- Persister le mot-clé comparé dans l'URL du dashboard, au même titre que les filtres croisés.

**Non-Goals:**
- Pas de courbe d'évolution temporelle comparée (score ponctuel uniquement — décision validée).
- Pas d'intégration dans l'export PDF ni dans le résumé exécutif IA pour cette itération : ces deux surfaces restent scopées au seul run courant, comme aujourd'hui.
- Pas de sélection d'un run d'import précis quand un mot-clé a été importé plusieurs fois : toujours son run le plus récent ayant des messages (même règle que « Default Scope To Latest Import Run », appliquée par mot-clé).
- Pas de comparaison à plus de deux mots-clés.

## Decisions

### Résolution du second run : par mot-clé, run le plus récent avec messages
Nouveau module `insight-hub-web/src/db/keyword-comparison.ts` avec deux fonctions :
- `getComparableKeywords(excludeKeyword: string | null): Promise<string[]>` — mot-clés distincts ayant au moins un run avec au moins un message, triés alphabétiquement, en excluant (comparaison insensible à la casse) le mot-clé du run courant.
- `getLatestRunIdForKeyword(keyword: string): Promise<number | null>` — id du run le plus récent (comparaison insensible à la casse sur `importRuns.keyword`) ayant au moins un message, ou `null` si aucun.

Alternative écartée : lister les runs individuels (et non les mots-clés) dans le sélecteur. Écartée par décision produit (granularité « par mot-clé ») — plus simple à parcourir pour l'utilisateur, et cohérent avec le fait que le dashboard raisonne déjà partout en « dernier run d'un mot-clé » plutôt qu'en run précis.

### `compareKeyword` comme champ de `DashboardFilters`, hors `dashboardFilterConditions`
`compareKeyword?: string` est ajouté au type `DashboardFilters` et parsé dans `parseDashboardFilters` (paramètre d'URL `?compareKeyword=...`), pour rester la source unique de vérité du parsing d'URL du dashboard. Il ne participe pas à `dashboardFilterConditions` (ce n'est pas une condition SQL sur `messages` mais un sélecteur de second `runId`) — même traitement que `query`/`favoritesOnly`, déjà présents dans `DashboardFilters` sans être agrégés dans ce helper.
Conséquence : `buildExportPdfHref` (page.tsx) n'inclut pas `compareKeyword`, exactement comme il n'inclut déjà pas `query`/`favorisUniquement` — l'export PDF reste scopé au seul run courant (Non-Goal ci-dessus).

### Réutilisation directe des fonctions KPI existantes avec le second `runId`
`page.tsx` résout `compareRunId` via `getLatestRunIdForKeyword(filters.compareKeyword)` puis appelle, en plus des appels existants pour `runId`, les mêmes fonctions (`getNetSentimentScore`, `getPlatformDistribution`, `getCountryDistribution`, `getThemeRanking`) avec `compareRunId` et **les mêmes `filters`** (donc les mêmes filtres croisés actifs — décision produit). Ces fonctions gèrent déjà `runId === null` (retour `null`/`[]`), donc aucune modification de leur signature n'est nécessaire. Les appels sont ajoutés au `Promise.all` existant pour rester parallèles.

Alternative écartée : dupliquer une logique d'agrégation dédiée à la comparaison. Écartée — violerait l'exigence « restitution uniquement, aucun nouveau calcul » et diverge de la logique déjà validée (et testée) pour chaque KPI.

### Un nouveau composant carte dédié, pas de modification des cartes existantes
Deux nouveaux fichiers dans `insight-hub-web/src/app/dashboard/` :
- `keyword-comparison-select.tsx` (`"use client"`) : liste déroulante des mots-clés comparables (+ option « Aucune comparaison »), pousse `compareKeyword` dans les paramètres d'URL via `useRouter`/`useSearchParams`, sur le même modèle que `search-bar.tsx`.
- `keyword-comparison-card.tsx` (composant serveur, purement présentationnel) : reçoit en props le mot-clé courant, le mot-clé comparé (le cas échéant), la liste des mots-clés comparables, et les KPIs des deux côtés déjà calculés ; rend le sélecteur puis, si un mot-clé comparé est actif, une mise en page à deux colonnes (courant / comparé) réutilisant les mêmes libellés/formats d'affichage que `NetSentimentCard`/`DistributionCard`/`TopThemesCard` (score net, listes triées plateforme/pays/thèmes) sans instancier ces composants (leur habillage carte individuel — kicker/titre — ne convient pas à une disposition à deux colonnes compacte).

Alternative écartée : intégrer le sélecteur dans `filter-bar.tsx`. Écartée pour ne pas coupler une fonctionnalité optionnelle et indépendante (comparaison) au composant de filtres croisés déjà bien délimité et testé.

Placement dans `page.tsx` : juste après `<SearchBar />` / les résultats de recherche, avant `<ExecutiveSummaryCard />` — une section d'orientation de haut niveau, avant le détail des KPIs du run courant qui suit.

### États vides et cas limites
- **Aucun mot-clé comparable** (un seul mot-clé jamais importé) : le sélecteur reste visible mais désactivé, avec un message explicite (« Importez un second mot-clé pour activer la comparaison ») plutôt qu'être masqué silencieusement.
- **`compareKeyword` réglé via l'URL sur une valeur sans run avec messages** (édition manuelle de l'URL, mot-clé supprimé entre deux visites) : `getLatestRunIdForKeyword` retourne `null` ; la carte affiche un message explicite (« Aucun import disponible pour ce mot-clé ») plutôt que de masquer silencieusement la comparaison.
- **KPI indéfini d'un côté** (aucun message classé pour ce run/ces filtres) : chaque colonne affiche indépendamment le même état vide que la carte correspondante en mode simple (ex. « score net indéfini », thème à 0 message) — pas de traitement spécial à la comparaison.
- **`compareKeyword` égal (insensible à la casse) au mot-clé du run courant** : exclu de la liste du sélecteur, donc non atteignable depuis l'UI ; si forcé via l'URL, se comporte sans erreur (les deux colonnes affichent alors les mêmes données) — aucun garde-fou dédié nécessaire.

## Risks / Trade-offs

- [Deux mots-clés avec des périodes calendaires disjointes + filtre de période actif] → un des deux côtés peut se retrouver vide alors que ses données existent hors période filtrée. Mitigation : l'état vide explicite (voir ci-dessus) évite toute lecture erronée (ex. confondre avec une absence totale de données) ; comportement volontairement identique aux autres KPIs déjà filtrés par période.
- [Sélecteur listant potentiellement de nombreux mots-clés au fil des imports] → liste déroulante longue à terme. Mitigation acceptée pour cette itération (tri alphabétique) ; un mécanisme de recherche/filtrage dans le sélecteur pourra être ajouté ultérieurement si le nombre de mots-clés importés le justifie.

## Migration Plan

Aucune migration de schéma ni de données. Déploiement standard (nouveau code lu à la demande, `dynamic = "force-dynamic"` déjà en place sur la page dashboard). Aucun rollback spécifique requis : la fonctionnalité est additive et n'affecte aucun KPI existant en l'absence de `compareKeyword` dans l'URL.
