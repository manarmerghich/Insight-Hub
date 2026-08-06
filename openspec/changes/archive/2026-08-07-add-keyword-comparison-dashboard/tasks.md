## 1. Résolution des mots-clés comparables (couche données)

- [x] 1.1 Créer `insight-hub-web/src/db/keyword-comparison.ts` avec `getComparableKeywords(excludeKeyword: string | null): Promise<string[]>` (mots-clés distincts ayant au moins un run avec au moins un message, triés alphabétiquement, comparaison insensible à la casse pour l'exclusion)
- [x] 1.2 Ajouter `getLatestRunIdForKeyword(keyword: string): Promise<number | null>` dans le même module (run le plus récent ayant au moins un message pour ce mot-clé, comparaison insensible à la casse)
- [x] 1.3 Écrire `insight-hub-web/src/db/keyword-comparison.test.ts` couvrant : plusieurs mots-clés distincts, mot-clé courant exclu, mot-clé importé plusieurs fois (run le plus récent retenu), mot-clé sans run avec message (`null`), aucun mot-clé comparable disponible

## 2. Filtres et état d'URL

- [x] 2.1 Ajouter `compareKeyword?: string` à `DashboardFilters` (`insight-hub-web/src/db/dashboard-filters.ts`) et le parser depuis le paramètre d'URL `compareKeyword` dans `parseDashboardFilters`
- [x] 2.2 Vérifier/adapter `insight-hub-web/src/db/dashboard-filters.test.ts` pour couvrir le parsing de `compareKeyword` (présent, absent, chaîne vide)
- [x] 2.3 Confirmer que `compareKeyword` reste hors de `dashboardFilterConditions` (aucune condition SQL générée pour ce champ) — ajouter un test si nécessaire

## 3. Composants d'interface

- [x] 3.1 Créer `insight-hub-web/src/app/dashboard/keyword-comparison-select.tsx` (`"use client"`) : liste déroulante des mots-clés comparables + option « Aucune comparaison », met à jour le paramètre `compareKeyword` de l'URL via `useRouter`/`useSearchParams`/`usePathname` (même schéma que `search-bar.tsx`), désactivée avec message explicite si aucun mot-clé comparable
- [x] 3.2 Créer `insight-hub-web/src/app/dashboard/keyword-comparison-card.tsx` (composant serveur présentationnel) : rend le sélecteur puis, si un mot-clé comparé est résolu, une disposition à deux colonnes (score net, répartition plateforme, répartition pays, classement des thèmes) pour le run courant et le run comparé ; affiche un message explicite si le mot-clé comparé ne résout à aucun run
- [x] 3.3 Ajouter les styles CSS correspondants dans `insight-hub-web/src/app/globals.css` (deux colonnes responsive, réutilisation de la palette existante — voir les classes `dashboard-grid--split` et `net-score-comparison` comme référence de style)

## 4. Intégration dans la page dashboard

- [x] 4.1 Dans `insight-hub-web/src/app/dashboard/page.tsx`, appeler `getComparableKeywords` (mot-clé du dernier run exclu) et, si `filters.compareKeyword` est défini, `getLatestRunIdForKeyword` pour résoudre `compareRunId`
- [x] 4.2 Ajouter au `Promise.all` existant les appels à `getNetSentimentScore`, `getPlatformDistribution`, `getCountryDistribution`, `getThemeRanking` avec `compareRunId` et les **mêmes `filters`** que le run courant
- [x] 4.3 Rendre `<KeywordComparisonCard />` avec ces données, positionné après `<SearchBar />` / les résultats de recherche et avant `<ExecutiveSummaryCard />`
- [x] 4.4 Vérifier que `buildExportPdfHref` et l'appel à `getExecutiveSummary` ne reçoivent ni ne prennent en compte `compareKeyword` (l'export PDF et le résumé exécutif restent scopés au seul run courant)

## 5. Vérification

- [x] 5.1 Lancer la suite de tests (`npm test` ou équivalent dans `insight-hub-web`) et vérifier que tous les tests passent, y compris les nouveaux
- [x] 5.2 Tester manuellement avec Playwright : sélection d'un second mot-clé, affichage côte à côte, interaction avec les filtres croisés pendant une comparaison active, désactivation de la comparaison, cas « un seul mot-clé importé », responsive (mobile/desktop) — voir note ci-dessous : la base partagée n'a qu'un seul mot-clé importé (`NIKE`), donc le cas « un seul mot-clé importé » a été vérifié via l'UI réelle ; le cas « comparaison active/deux colonnes/désactivation/responsive » a été vérifié en forçant `?compareKeyword=` (même chemin de rendu que la sélection via le menu déroulant), faute d'un second mot-clé réel à sélectionner
