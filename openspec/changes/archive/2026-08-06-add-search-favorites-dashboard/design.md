## Context

Le dashboard (`insight-hub-web/src/app/dashboard`) affiche aujourd'hui uniquement des agrégats calculés côté serveur (scores, répartitions, classements) via des fonctions de lecture dans `src/db/*.ts`, toutes scopées au dernier run d'import (`getLatestImportRun`) et filtrables par les cinq dimensions de `DashboardFilters` (`src/db/dashboard-filters.ts` : période, plateforme, pays, sentiment, thème), portées par les query params de l'URL et appliquées via `dashboardFilterConditions(...)`. Aucun composant n'affiche aujourd'hui une liste de messages individuels navigable — seuls des messages représentatifs isolés apparaissent (ex. pics de sentiment).

L'application n'a pas de système d'authentification ni de notion d'utilisateur connecté : le dashboard est consulté par une seule audience (l'équipe marketing/communication) sans séparation de comptes. Les favoris sont donc une donnée globale au dashboard, pas propre à un utilisateur.

Le schéma est possédé exclusivement par `insight-hub-web` (Drizzle + `drizzle-kit`) ; `insight-hub-pipeline` n'écrit que les colonnes existantes (import, sentiment, thème) et n'a pas besoin de connaître les nouvelles colonnes.

## Goals / Non-Goals

**Goals:**
- Recherche plein texte sur `messages.text`, native Postgres (`tsvector`/GIN), scopée au dernier run et combinable en ET avec les filtres croisés existants.
- Marquage/démarquage d'un message comme favori, persisté en base, avec retour visuel immédiat (mise à jour optimiste) sans attendre l'aller-retour serveur.
- Un contrôle "favoris uniquement" composable avec la recherche et les filtres croisés.
- Réutiliser le pattern existant (état dans l'URL, conditions Drizzle composables, cartes de style existant) plutôt qu'introduire un nouveau mécanisme d'état ou une bibliothèque UI.

**Non-Goals:**
- Pas de pagination complète de la liste de résultats : la liste est plafonnée à un nombre fixe de messages (les plus pertinents/récents) ; au-delà, l'utilisateur est invité à affiner sa recherche. Un vrai mécanisme de pagination pourra être ajouté plus tard si le besoin se confirme.
- Pas de mise en évidence (surlignage) des termes recherchés dans le texte affiché — améliore l'UX mais n'est pas nécessaire pour "retrouver" un message.
- Pas de favoris par utilisateur (pas de système d'auth dans l'application) : un favori est visible par quiconque consulte le dashboard.
- Pas de recherche inter-runs : comme tous les autres KPIs du dashboard, la recherche ne porte que sur le dernier run d'import.
- Aucun nouveau traitement dans `insight-hub-pipeline` : ni la recherche ni les favoris ne déclenchent de calcul IA ou de modification du pipeline d'import.

## Decisions

### Recherche : colonne générée `tsvector` + index GIN, config `simple`
Ajout d'une colonne générée stockée `search_vector` (`tsvector`) sur `messages`, dérivée de `text` via `to_tsvector('simple', text)`, indexée par un index GIN. La requête utilisateur est transformée via `websearch_to_tsquery('simple', query)` (syntaxe tolérante : phrases entre guillemets, `OR`, exclusion avec `-`, proche de ce qu'un utilisateur tape dans une barre de recherche généraliste) puis comparée avec l'opérateur `@@`.

Configuration `simple` plutôt que `english`/`french` : le jeu de données est un CSV importé sans garantie de langue unique (le jeu d'exemple est en anglais, mais un futur import peut être en français ou mixte). `simple` tokenise et met en minuscule sans appliquer de racinisation ni de liste de mots vides propre à une langue — un choix plus prévisible qu'un mauvais choix de langue qui dégraderait silencieusement le rappel.

Alternative écartée : `ILIKE '%terme%'` sur `text` brut. Plus simple à implémenter mais ne permet ni recherche multi-mots avec opérateurs, ni tri par pertinence, ni usage d'un index performant sans `pg_trgm` — l'architecture (@ARCHITECTURE.md) tranche explicitement pour `tsvector`/GIN, ce choix est donc conservé.

### Tri des résultats
- Si une recherche textuelle est active : tri par pertinence (`ts_rank(search_vector, query)` décroissant), puis par `id` croissant en cas d'égalité (déterministe).
- Si seul le filtre "favoris uniquement" est actif (pas de recherche texte) : tri par date décroissante (les plus récents en premier), cohérent avec la lecture chronologique des autres vues du dashboard.

### Plafond de résultats sans pagination
La liste est plafonnée à 50 messages. Si le nombre total de correspondances dépasse ce plafond, un message informe l'utilisateur qu'il existe davantage de résultats et l'invite à affiner sa recherche (période, plateforme, sentiment, thème). Ce plafond évite une liste non bornée pour un besoin de restitution ("retrouver un message"), pas d'exhaustivité analytique — ce rôle reste porté par les KPIs agrégés existants.

### Favori : colonne booléenne sur `messages`, pas de table séparée
Ajout d'une colonne `is_favorite` (`boolean`, défaut `false`, `not null`) directement sur `messages`, plutôt qu'une table de jointure séparée (comme `sentiment_validation_samples`). Un favori est un attribut binaire et global du message, sans métadonnée additionnelle nécessaire (pas de multi-utilisateur, pas d'historique requis par le besoin) : une colonne est plus simple à interroger et à combiner avec les conditions de filtre existantes qu'une jointure.

### Bascule du favori : Server Action + `useOptimistic`
Une Server Action (`toggleMessageFavorite(messageId, next)`) exécute une mise à jour Drizzle ciblée sur `messages.id`. Le composant client de chaque ligne de résultat utilise `useOptimistic` pour refléter l'état immédiatement, avant confirmation serveur, avec retour à l'état précédent en cas d'échec. Conforme au choix déjà arrêté dans @ARCHITECTURE.md.

### État de recherche/favoris porté par l'URL
`query` (texte de recherche) et `favoritesOnly` (booléen) rejoignent `DashboardFilters` comme paramètres d'URL (`q`, `favorisUniquement`), au même titre que les filtres croisés existants — cohérence avec la capacité `dashboard-cross-filters` (état partageable, rechargement fidèle). Le texte de recherche est débouncé côté client avant de pousser une nouvelle URL, pour éviter une requête serveur à chaque frappe.

### Visibilité de la liste de résultats
La liste de messages ne s'affiche que lorsqu'une recherche est active OU que "favoris uniquement" est coché — jamais par défaut. Afficher par défaut un extrait des ~700+ messages du run n'apporterait rien (ce rôle est déjà couvert par les KPIs agrégés) et introduirait une liste longue à charger sans intention de recherche de l'utilisateur.

## Risks / Trade-offs

- [Colonne générée `tsvector` mal supportée par la génération automatique de `drizzle-kit`] → Vérifier le SQL généré après `drizzle-kit generate` ; si l'expression générée ou l'index GIN n'est pas correctement exprimé par le schéma Drizzle, écrire la migration SQL à la main (colonne générée + `CREATE INDEX ... USING GIN`) plutôt que de forcer un schéma Drizzle non naturel.
- [Config `simple` sans racinisation] → Une recherche "aime" ne retrouvera pas "aimé"/"aimer". Accepté comme compromis : plus prévisible qu'un mauvais choix de langue, et le besoin exprimé est de "retrouver" un message plutôt que d'maximiser le rappel linguistique.
- [Favoris globaux, non attribuables à un utilisateur] → Acceptable tant qu'il n'y a pas d'authentification ; si un système d'auth est introduit plus tard, migration ultérieure nécessaire pour rattacher les favoris à un utilisateur (hors périmètre de ce changement).
- [Plafond de 50 résultats sans pagination] → Un utilisateur avec une recherche très large ne verra pas tous les messages correspondants ; mitigé par le message d'invite à affiner et par la combinabilité avec les filtres croisés déjà en place.

## Migration Plan

1. Étendre `src/db/schema.ts` : colonne `is_favorite` (booléen, défaut `false`) et colonne générée `search_vector` (`tsvector`) sur `messages`.
2. Générer la migration via `drizzle-kit generate`, vérifier/compléter manuellement l'expression de la colonne générée et l'index GIN si nécessaire.
3. Appliquer la migration sur Neon (même flux que les migrations existantes).
4. Aucune rétrocompatibilité à gérer côté `insight-hub-pipeline` : le service Python n'écrit pas ces colonnes et n'a pas besoin d'évoluer.
5. Rollback : migration additive uniquement (nouvelles colonnes/index, aucune colonne existante modifiée ou supprimée) — un rollback consiste à supprimer les deux colonnes ajoutées si nécessaire, sans impact sur les données existantes.
