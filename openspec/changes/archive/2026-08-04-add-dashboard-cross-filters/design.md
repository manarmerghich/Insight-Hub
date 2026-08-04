## Context

`/dashboard` (voir `sentiment-and-distribution-dashboard`) affiche aujourd'hui trois KPIs scopés uniquement au dernier run d'import ayant des messages : score net + évolution (`db/net-sentiment-score.ts`), répartition plateforme et répartition pays (`db/message-distribution.ts`). `messages` porte déjà toutes les colonnes nécessaires aux cinq dimensions de filtre demandées (`timestamp`, `platform`, `country`, `sentiment`/`sentiment_original`, `theme_id`) ; aucune migration n'est nécessaire. `theme-ranking.ts` (top thèmes) existe mais n'est pas encore affiché sur le dashboard — il reste hors périmètre de ce changement (voir Non-Goals).

`insight-hub-web` n'a aucune dépendance de state management ni de composants de formulaire au-delà de React/Next natifs (voir `package.json`) ; la contrainte projet est de préférer l'existant. Le seul précédent de Client Component interactif est `top-nav.tsx` (`usePathname`, `next/link`), qui sert de modèle.

## Goals / Non-Goals

**Goals:**
- Ajouter cinq contrôles de filtre (période, plateforme, pays, sentiment, thème) sur `/dashboard`, combinables en `AND`.
- Appliquer ces filtres, en plus du scope existant "dernier import", aux trois KPIs déjà affichés (score net + évolution, répartition plateforme, répartition pays).
- Garder l'état des filtres dans l'URL (`searchParams`), pour rester partageable et cohérent avec le rendu `force-dynamic` déjà en place.
- Ne dépendre que de colonnes déjà persistées — aucun nouveau calcul IA, aucune migration de schéma, aucune nouvelle dépendance npm.

**Non-Goals:**
- Afficher un nouveau KPI "top thèmes" sur le dashboard — le filtre thème s'applique aux KPIs existants, il n'introduit pas de carte de répartition par thème. Un futur changement pourra restituer `theme-ranking` sur le dashboard.
- Narrowing facetté des options de filtre entre elles (ex. réduire la liste des pays disponibles une fois une plateforme choisie) — chaque liste d'options reste dérivée de l'ensemble du dernier import, indépendamment des autres filtres actifs.
- Comparaison période vs période précédente, sélection d'un run d'import différent du dernier — items V1/non-goals distincts déjà actés dans `sentiment-and-distribution-dashboard`.
- Persistance des filtres au-delà de l'URL (pas de cookie/préférence utilisateur enregistrée).

## Decisions

### État des filtres porté par `searchParams`, pas par un state client
`dashboard/page.tsx` (Server Component, Next 15) reçoit `searchParams` (déjà un mécanisme natif, aucune dépendance à ajouter), les parse en un objet `DashboardFilters`, et les passe directement aux fonctions `db/`. La barre de filtres est un Client Component qui lit les valeurs courantes via `useSearchParams()` et pousse une nouvelle URL via `useRouter().push()` à chaque changement de contrôle — même pattern que `top-nav.tsx`. Comme la page est déjà `export const dynamic = "force-dynamic"`, aucun `<Suspense>` n'est requis autour de `useSearchParams()` pour éviter une dégradation de pré-rendu statique : il n'y a de toute façon pas de rendu statique à préserver ici.

Alternative écartée : un state React côté client (`useState` + fetch API interne) pour piloter l'affichage. Rejetée : perdrait le caractère partageable/bookmarkable de l'URL, et réintroduirait un aller-retour HTTP interne que la page évite volontairement depuis `sentiment-and-distribution-dashboard` (lecture directe depuis le Server Component).

### Un type `DashboardFilters` partagé, appliqué comme conditions SQL additionnelles
Nouveau module `db/dashboard-filters.ts` exportant :
```
type DashboardFilters = {
  dateFrom?: string;   // "YYYY-MM-DD"
  dateTo?: string;     // "YYYY-MM-DD"
  platform?: string;
  country?: string;    // peut valoir UNKNOWN_COUNTRY_LABEL ("Non renseigné")
  sentiment?: "positif" | "négatif" | "neutre";
  themeId?: number;
};
```
et des fonctions `dateRangeCondition`, `platformCondition`, `countryCondition`, `themeCondition` retournant chacune soit `undefined` (filtre inactif), soit une condition Drizzle à ajouter au `and(...)` existant de chaque requête. `getNetSentimentScore`, `getDailyNetSentimentEvolution`, `getPlatformDistribution`, `getCountryDistribution` gagnent un second paramètre `filters: DashboardFilters` et composent `and(eq(messages.runId, runId), ...conditionsActives)`.

Alternative écartée : dupliquer la construction des conditions dans chacune des 4 fonctions. Rejetée : les cinq dimensions de filtre sont identiques partout, un module partagé évite la divergence (ex. oublier le cas "Non renseigné" dans une seule des deux fonctions de répartition).

### Filtre pays : "Non renseigné" traité comme une valeur de filtre à part entière
Cohérent avec `getCountryDistribution` existant (`db/message-distribution.ts:52`), qui regroupe déjà `country` nul/vide sous ce libellé. `countryCondition` traduit la valeur `UNKNOWN_COUNTRY_LABEL` en `or(isNull(messages.country), eq(sql`trim(${messages.country})`, ''))`, plutôt qu'une simple égalité qui ne matcherait aucune ligne pour cette option.

### Filtre sentiment : suit la source active (`NET_SENTIMENT_SOURCE`), pas seulement le mode IA
Le score net a déjà deux modes (`"ai"` via `messages.sentiment`, `"csv_original"` via mapping JS de `sentiment_original`, voir `net-sentiment-score.ts`). Pour que le filtre sentiment reste cohérent avec ce que la carte de score net affiche déjà, `sentimentCondition` respecte le même flag :
- mode `"ai"` (actif en production aujourd'hui) : `and(eq(messages.sentimentStatus, 'completed'), eq(messages.sentiment, filters.sentiment))`.
- mode `"csv_original"` (fallback inactif) : traduit `"positif"/"négatif"` en l'ensemble des libellés bruts reconnus (réutilise les `Set` déjà exportés par `original-sentiment-mapping.ts`) via `inArray(sql`lower(trim(${messages.sentimentOriginal}))`, [...labels])` ; `"neutre"` est le complément (tout libellé non reconnu positif/négatif, y compris vide), donc `not(inArray(..., [...positive, ...negative]))`.

Pour éviter une dépendance circulaire (`net-sentiment-score.ts` → `dashboard-filters.ts` → `net-sentiment-score.ts`), `dashboard-filters.ts` ne importe pas `NET_SENTIMENT_SOURCE` : `sentimentCondition` le reçoit en paramètre explicite, fourni par l'appelant (`net-sentiment-score.ts` et `message-distribution.ts` importent tous deux la constante depuis `net-sentiment-score.ts`).

Alternative écartée : ne filtrer par sentiment qu'en mode IA, en désactivant silencieusement le filtre en mode `csv_original`. Rejetée : le mode `csv_original` reste un vrai chemin de secours documenté (voir design de `sentiment-and-distribution-dashboard`) ; un filtre qui se tairait silencieusement en cas de bascule de secours serait une régression discrète.

### Filtre thème : restreint aux thèmes déjà classés dans ce run
`themeCondition` ajoute `and(eq(messages.themeId, filters.themeId), eq(messages.themeStatus, 'completed'))`. Les options proposées dans le contrôle (voir décision suivante) n'incluent que les thèmes ayant au moins un message `completed` dans le dernier run — un thème du référentiel sans aucun message classé ne serait de toute façon jamais un filtre utile.

### Nouveau module `getDashboardFilterOptions(runId)` pour peupler les contrôles
Une requête dédiée (`db/dashboard-filter-options.ts`) retourne, pour le dernier run : les plateformes distinctes, les pays distincts (avec `UNKNOWN_COUNTRY_LABEL` ajouté si au moins un message a un pays nul/vide), les thèmes distincts déjà classés (`id` + `label`, jointure sur `themes`), et les bornes min/max de `messages.timestamp` (pour les attributs `min`/`max` des champs de date). Les options de sentiment ne nécessitent pas de requête : domaine fixe `["positif", "négatif", "neutre"]`, affiché identiquement quel que soit `NET_SENTIMENT_SOURCE`.

Ces listes sont calculées sur le run entier, indépendamment des autres filtres déjà sélectionnés (voir Non-Goals — pas de narrowing facetté), pour rester une seule requête simple plutôt que de recalculer les options à chaque changement de filtre.

### Composant `FilterBar` : Client Component avec des `<select>`/`<input type="date">` natifs
Pas de bibliothèque de date picker ni de composants de formulaire — cohérent avec la contrainte projet et le fait qu'aucune dépendance de ce type n'existe déjà. Chaque contrôle déclenche, `onChange`, la construction d'un nouvel `URLSearchParams` (valeur ajoutée/retirée) et `router.push(`${pathname}?${params}`)`. Un bouton "Réinitialiser" navigue vers `pathname` sans paramètre. Style réutilisant les variables CSS déjà définies dans `globals.css` (cartes, couleurs), pas de nouvelle bibliothèque UI.

### Validation permissive des paramètres d'URL : filtre ignoré plutôt qu'erreur
`searchParams` étant une entrée utilisateur (URL modifiable manuellement), `page.tsx` ignore silencieusement toute valeur qui ne correspond pas au format attendu (ex. `themeId` non numérique, date invalide) plutôt que de lever une erreur — le filtre concerné retombe sur "inactif". Une combinaison de filtres valides mais ne retournant aucun résultat (ex. plateforme + pays qui ne coexistent jamais) affiche les états vides déjà existants de chaque carte, sans message dédié supplémentaire.

## Risks / Trade-offs

- [Les listes d'options (plateforme/pays/thème) ne se réduisent pas mutuellement entre elles : l'utilisateur peut sélectionner une combinaison qui ne retourne aucun résultat] → Acceptable pour ce MVP (états vides déjà gérés par les cartes existantes) ; un narrowing facetté pourra être ajouté si ce cas s'avère fréquent en usage réel.
- [Le filtre sentiment en mode `csv_original` (fallback inactif) utilise une clause `NOT IN` sur des libellés bruts pour la catégorie "neutre", plus coûteuse et plus complexe qu'une égalité simple] → Acceptable : ce mode n'est pas actif en production aujourd'hui (`NET_SENTIMENT_SOURCE = "ai"`) ; réévaluer si une bascule de secours prolongée en fait un chemin réellement emprunté.
- [Changer la signature des 4 fonctions `db/` existantes (ajout du paramètre `filters`) touche du code déjà couvert par les specs `net-sentiment-score` et `platform-country-distribution`] → Anticipé : ces deux specs reçoivent une delta spec dans ce changement (voir proposal.md).

## Migration Plan

Aucune migration de schéma. Déploiement direct : nouveaux modules `db/dashboard-filters.ts` et `db/dashboard-filter-options.ts`, nouveau composant `FilterBar`, signatures étendues (paramètre additionnel, non-breaking pour tout autre appelant puisqu'il n'y en a pas hors `dashboard/page.tsx`), `page.tsx` lit `searchParams`. Rollback = retrait des fichiers ajoutés et retour des 4 fonctions `db/` à leur signature `(runId)` actuelle, sans impact sur les données.

## Open Questions

Aucune à ce stade — le périmètre est entièrement dérivé de colonnes déjà persistées et de patterns déjà établis dans le dashboard existant.
