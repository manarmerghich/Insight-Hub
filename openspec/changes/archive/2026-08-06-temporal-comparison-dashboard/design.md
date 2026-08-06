## Context

Le dashboard affiche déjà le score de sentiment net courant (`getNetSentimentScore`, dans `insight-hub-web/src/db/net-sentiment-score.ts`), scopé au dernier run d'import et aux filtres croisés actifs (`DashboardFilters` : `dateFrom`, `dateTo`, `platform`, `country`, `sentiment`, `themeId` — voir `dashboard-filters.ts` et la capacité `dashboard-cross-filters`). Le filtre de période est le seul contrôle qui définit une fenêtre de dates explicite ; les autres dimensions ne portent pas de notion temporelle.

Aucune donnée en base ne dépasse le dernier run d'import : les KPIs n'agrègent jamais plusieurs runs. La « période précédente » n'existe donc que comme une seconde fenêtre de dates *à l'intérieur* de l'étendue temporelle des messages de ce même run — pas un run antérieur.

Le PRD (§1.6) impose qu'un chiffre soit toujours accompagné d'une comparaison ; ce changement couvre cette exigence pour le score de sentiment net uniquement (décision validée avec l'utilisateur — voir Decisions).

## Goals / Non-Goals

**Goals:**
- Afficher, à côté du score de sentiment net courant, l'écart en points avec le score de sentiment net de la période précédente équivalente (même durée en jours, immédiatement avant la période courante).
- Réutiliser sans modification `getNetSentimentScore` et les conditions de filtre existantes (`dashboardFilterConditions`, `dateRangeCondition`) — aucune nouvelle requête SQL structurellement différente, seulement un second appel avec une fenêtre de dates décalée.
- Gérer explicitement les cas où la comparaison n'a pas de sens (pas de filtre de période actif) ou pas de donnée (période précédente vide), sans jamais afficher un delta trompeur.

**Non-Goals:**
- Comparer d'autres KPIs (score pondéré par engagement, taux d'engagement par sentiment, répartitions) — hors scope de ce changement, décision validée avec l'utilisateur ; pourra faire l'objet d'un changement ultérieur suivant le même patron.
- Superposer deux courbes d'évolution (courante vs précédente) sur le graphique existant — seul le score agrégé est comparé, pas la série journalière.
- Comparer à une période antérieure à l'étendue du dernier run d'import, ou à un run d'import différent.
- Rendre la durée de la « période précédente » configurable indépendamment de la période courante.

## Decisions

### 1. Scope limité au score de sentiment net (pas les autres KPIs)
Seul KPI explicitement rattaché à cette fonctionnalité dans la chaîne de dépendances du PRD (§3 : « Comparaison temporelle » dépend uniquement de « Sentiment Score net + évolution »). Élargir aux autres KPIs restitution (score pondéré, taux d'engagement) est possible plus tard en réappliquant le même patron (helper de période précédente + second appel de la fonction de calcul existante), mais n'est pas nécessaire pour répondre à l'exigence du PRD. *Décision validée avec l'utilisateur.*

### 2. Comparaison masquée sans filtre de période explicite
Sans `dateFrom`/`dateTo` actifs, la « période courante » du dashboard correspond à toute l'étendue du dernier run d'import. La « période précédente équivalente » n'aurait alors, par construction, aucun message dans ce run (rien n'existe avant la borne de début du run). Plutôt que d'afficher systématiquement un état « comparaison indisponible » qui n'apporterait aucune information, la comparaison est masquée et remplacée par une invitation à sélectionner une période via le filtre existant. *Décision validée avec l'utilisateur.*

- Condition retenue : la comparaison n'est calculée que si **`dateFrom` ET `dateTo`** sont tous deux définis et valides. Un seul des deux bornes ne suffit pas à déterminer une durée de période, donc pas de fenêtre précédente calculable.

### 3. Calcul de la période précédente équivalente
Étant donné `dateFrom` et `dateTo` (chaînes `YYYY-MM-DD`, bornes inclusives déjà utilisées par `dateRangeCondition`) :
- Durée en jours calendaires : `lengthInDays = joursEntre(dateFrom, dateTo) + 1` (borne à borne inclus).
- Période précédente : se termine la veille de `dateFrom`, dure `lengthInDays` jours → `previousDateTo = dateFrom - 1 jour`, `previousDateFrom = previousDateTo - (lengthInDays - 1) jours`.
- Exemple : période courante `2026-07-01` → `2026-07-07` (7 jours) ⇒ période précédente `2026-06-24` → `2026-06-30` (7 jours).
- Arithmétique sur les dates effectuée en UTC (minuit) pour éviter tout décalage de fuseau horaire, cohérent avec la manière dont `dateRangeCondition` interprète déjà ces chaînes.
- Nouvelle fonction pure `previousPeriodFilters(filters: DashboardFilters): DashboardFilters | null` ajoutée dans `dashboard-filters.ts` (aux côtés des autres helpers de filtre, car générique à toute période — pas spécifique au score net) : retourne `null` si `dateFrom`/`dateTo` manquants ou invalides, sinon un nouvel objet `DashboardFilters` avec les mêmes `platform`/`country`/`sentiment`/`themeId` mais `dateFrom`/`dateTo` décalés vers la fenêtre précédente.

**Alternative envisagée et rejetée** : placer ce helper directement dans `net-sentiment-score.ts`. Rejeté parce que le calcul de fenêtre précédente ne dépend d'aucune logique de sentiment — le co-localiser avec les autres helpers de filtre facilite une future réutilisation par d'autres KPIs sans dépendance croisée entre modules.

### 4. Aucun clamp artificiel de la fenêtre précédente
Si la fenêtre précédente déborde avant la première date de message du run (ex. période courante proche du début de l'historique), on ne raccourcit pas artificiellement la fenêtre : elle est passée telle quelle à `getNetSentimentScore`, qui retournera naturellement `null` si aucun message classé ne s'y trouve (comportement déjà existant, aucune modification requise). Le badge affiche alors l'état « comparaison indisponible » (voir Decision 5). Évite d'introduire une règle de troncature supplémentaire non demandée par le PRD.

### 5. Présentation UI : badge delta simple
Un badge à côté du chiffre existant (`kpi-value`), plutôt que deux valeurs côte à côte ou une superposition de courbes. *Décision validée avec l'utilisateur.* Réutilise les tokens CSS existants (`--color-success`, `--color-error`) déjà utilisés par `kpi-value--positive`/`--negative` et par les marqueurs de pic (`sentiment-timeline-peak-detection`), sans introduire de nouvelle palette.

États du badge (calculés dans un nouveau composant `NetScoreComparisonBadge`, rendu par `net-sentiment-card.tsx`) :
- **Pas de filtre de période actif** (`previousPeriodFilters` retourne `null`) : message discret invitant à filtrer par période, pas de couleur ni de flèche.
- **Score courant indisponible** (`score === null`) : badge non affiché — l'état vide du KPI lui-même couvre déjà ce cas, ajouter un badge serait redondant.
- **Score précédent indisponible** (`previousScore === null` alors qu'un filtre de période est actif) : message « Comparaison indisponible : aucun message classé sur la période précédente (DD MMM – DD MMM). », sans couleur ni flèche.
- **Delta positif/négatif/nul** : `delta = score - previousScore`, arrondi à l'entier le plus proche (déjà des entiers, `score`/`previousScore` étant produits par `computeNetScore` qui arrondit). Affiché avec une flèche (▲/▼/–) et coloré `--color-success` si `delta > 0`, `--color-error` si `delta < 0`, neutre (couleur texte par défaut) si `delta === 0`, accompagné du libellé de la période précédente affichée.

### 6. Point d'intégration : un appel supplémentaire dans `page.tsx`, pas une nouvelle route
`page.tsx` calcule déjà tous les KPIs via `Promise.all` côté serveur (composant serveur Next.js, `dynamic = "force-dynamic"`). La comparaison suit le même patron : calcul de `previousPeriodFilters(filters)`, puis, si non `null`, un appel supplémentaire à `getNetSentimentScore(runId, previousFilters)` ajouté au `Promise.all` existant (avec une garde conditionnelle, ex. `previousFilters ? getNetSentimentScore(runId, previousFilters) : Promise.resolve(null)`), sans endpoint API ni action serveur dédiée — cohérent avec le reste du dashboard qui est entièrement rendu côté serveur.

## Risks / Trade-offs

- [Confusion possible si l'utilisateur pense que la « période précédente » remonte plus loin que le run d'import] → Le message « comparaison indisponible » explicite (Decision 5) rend visible la limite plutôt que de la masquer silencieusement.
- [Ambiguïté sur la définition de « jour » aux bornes de fuseau horaire] → Arithmétique en UTC sur des dates calendaires pures (`YYYY-MM-DD`), cohérente avec `dateRangeCondition` existant ; pas de nouvelle convention introduite.
- [Le badge devient un second endroit à maintenir si la formule du score net change] → Le badge ne recalcule rien lui-même : il consomme deux valeurs déjà produites par `getNetSentimentScore`/`computeNetScore` ; toute évolution de la formule se propage automatiquement aux deux appels.
- [Portée volontairement limitée au score net peut décevoir si l'utilisateur attend une comparaison sur tous les KPIs] → Assumé et validé explicitement avec l'utilisateur (Decision 1) ; le patron posé ici (helper de période précédente réutilisable) rend l'extension à d'autres KPIs peu coûteuse dans un changement ultérieur si besoin.
