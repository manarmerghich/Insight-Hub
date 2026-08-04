## 1. Module de filtres partagé

- [x] 1.1 Créer `src/db/dashboard-filters.ts` : type `DashboardFilters` (`dateFrom`, `dateTo`, `platform`, `country`, `sentiment`, `themeId`) et fonctions `dateRangeCondition`, `platformCondition`, `countryCondition`, `themeCondition`, `sentimentCondition` (cette dernière reçoit `NET_SENTIMENT_SOURCE` en paramètre pour éviter une dépendance circulaire, voir design.md)
- [x] 1.2 Dans `countryCondition`, traiter la valeur `UNKNOWN_COUNTRY_LABEL` comme `country IS NULL OR trim(country) = ''`
- [x] 1.3 Dans `sentimentCondition`, gérer le mode `"ai"` (`eq(messages.sentiment, ...)` + `sentimentStatus = 'completed'`) et le mode `"csv_original"` (libellés bruts positifs/négatifs via `original-sentiment-mapping.ts`, "neutre" = complément `NOT IN`)

## 2. Application des filtres aux KPIs existants

- [x] 2.1 Étendre `getNetSentimentScore(runId, filters)` et `getDailyNetSentimentEvolution(runId, filters)` dans `src/db/net-sentiment-score.ts` pour composer les conditions de `dashboard-filters.ts` en plus du scope `runId` existant, dans les deux modes (`ai` et `csv_original`)
- [x] 2.2 Étendre `getPlatformDistribution(runId, filters)` et `getCountryDistribution(runId, filters)` dans `src/db/message-distribution.ts` de la même façon
- [x] 2.3 Vérifier que chaque fonction retourne toujours son état vide existant (score `null`, série/répartition vide) quand la combinaison de filtres ne correspond à aucun message

## 3. Options de filtre disponibles

- [x] 3.1 Créer `src/db/dashboard-filter-options.ts` avec `getDashboardFilterOptions(runId)` retournant les plateformes distinctes, les pays distincts (+ `UNKNOWN_COUNTRY_LABEL` si applicable), les thèmes distincts ayant au moins un message `theme_status = 'completed'`, et les bornes min/max de `messages.timestamp`, tous scopés au dernier run d'import
- [x] 3.2 Retourner la liste fixe `["positif", "négatif", "neutre"]` pour les options de sentiment, sans requête

## 4. Interface : barre de filtres et page dashboard

- [x] 4.1 Modifier `src/app/dashboard/page.tsx` pour lire `searchParams`, parser un `DashboardFilters` en ignorant silencieusement toute valeur invalide (date non parsable, `themeId` non numérique), et le passer aux quatre fonctions `db/`
- [x] 4.2 Appeler `getDashboardFilterOptions(runId)` dans `page.tsx` et transmettre les options au composant de filtres
- [x] 4.3 Créer le composant Client `src/app/dashboard/filter-bar.tsx` (`"use client"`, `useSearchParams`/`useRouter`/`usePathname`) avec les cinq contrôles (deux champs `<input type="date">`, trois `<select>`) mettant à jour l'URL au changement
- [x] 4.4 Ajouter un bouton de réinitialisation qui navigue vers `/dashboard` sans paramètre
- [x] 4.5 Ajouter les classes CSS de la barre de filtres dans `globals.css`, en réutilisant les variables de couleur et le style des cartes déjà définis

## 5. Vérification

- [x] 5.1 Exécuter `openspec validate add-dashboard-cross-filters --strict` et corriger les éventuels écarts
- [x] 5.2 Tester manuellement avec Playwright : chaque dimension de filtre seule, une combinaison de plusieurs filtres, une combinaison sans résultat, la réinitialisation, le partage d'une URL filtrée ; vérifier le rendu responsive
