## 1. Schéma et migration base de données

- [x] 1.1 Ajouter la colonne `is_favorite` (booléen, `not null`, défaut `false`) sur `messages` dans `src/db/schema.ts`
- [x] 1.2 Ajouter la colonne générée stockée `search_vector` (`tsvector`, `to_tsvector('simple', text)`) sur `messages` dans `src/db/schema.ts`
- [x] 1.3 Générer la migration via `drizzle-kit generate` puis vérifier le SQL produit pour la colonne générée
- [x] 1.4 Compléter manuellement la migration si nécessaire : expression de la colonne générée et `CREATE INDEX ... USING GIN (search_vector)` (non nécessaire — SQL généré correct tel quel)
- [x] 1.5 Appliquer la migration sur la base Neon de développement et vérifier la présence de la colonne, de l'index et du bon peuplement de `search_vector` sur les messages existants

## 2. Recherche plein texte — accès aux données

- [x] 2.1 Étendre `DashboardFilters` (`src/db/dashboard-filters.ts`) avec un champ `query?: string`
- [x] 2.2 Ajouter une fonction de condition de recherche (`websearch_to_tsquery('simple', query)` comparé à `search_vector` via `@@`), ignorant le filtre si `query` est vide/absent
- [x] 2.3 Créer `src/db/message-search.ts` avec une fonction `getMessageSearchResults(runId, filters)` qui : scope au run donné, applique `dashboardFilterConditions` + la condition de recherche + la condition favoris, trie par pertinence (`ts_rank`) si `query` est actif sinon par date décroissante, et plafonne à 50 résultats (+ récupération du compte total pour savoir si le plafond est dépassé)
- [x] 2.4 Ajouter des tests (Vitest) pour la construction de la condition de recherche et pour le tri/plafond de `getMessageSearchResults`

## 3. Favoris — accès aux données et Server Action

- [x] 3.1 Étendre `DashboardFilters` avec un champ `favoritesOnly?: boolean` et ajouter la condition de filtre correspondante (`eq(messages.isFavorite, true)`)
- [x] 3.2 Créer une Server Action `toggleMessageFavorite(messageId: number, next: boolean)` (ex. dans `src/app/dashboard/actions.ts`) qui met à jour `messages.isFavorite` par `id`
- [x] 3.3 Ajouter un test (Vitest) couvrant le comportement de la condition de filtre favoris

## 4. UI dashboard

- [x] 4.1 Ajouter le champ `q` (recherche) et `favorisUniquement` au parsing des `searchParams` dans `src/app/dashboard/page.tsx`, et appeler `getMessageSearchResults` uniquement quand l'un des deux est actif
- [x] 4.2 Créer un composant client `SearchBar` (champ texte débouncé, poussant le paramètre `q` dans l'URL, cohérent avec le pattern déjà utilisé par `FilterBar`) et une case à cocher "Favoris uniquement" poussant `favorisUniquement`
- [x] 4.3 Créer un composant `MessageSearchResults` affichant la liste des messages (texte, auteur, plateforme, date, sentiment) avec, pour chaque message, un composant client de bouton favori utilisant `useOptimistic` et appelant `toggleMessageFavorite`
- [x] 4.4 Ajouter l'état vide dédié (aucune correspondance) et le message d'invite à affiner quand le plafond de 50 résultats est dépassé
- [x] 4.5 Intégrer `SearchBar` et `MessageSearchResults` dans `src/app/dashboard/page.tsx`, masqués tant qu'aucune recherche ni filtre favoris n'est actif
- [x] 4.6 Ajouter les styles dans `globals.css` en respectant la palette et les conventions de cartes existantes (`.card`, styles `.filter-bar` comme référence)

## 5. Vérification

- [x] 5.1 Lancer `npm run build`/`tsc` et la suite Vitest pour valider qu'il n'y a pas de régression
- [x] 5.2 Tester manuellement avec Playwright : recherche avec résultats, recherche sans résultat, combinaison recherche + filtre croisé, marquage/démarquage d'un favori (y compris persistance après rechargement), activation du filtre "favoris uniquement", et rendu responsive
