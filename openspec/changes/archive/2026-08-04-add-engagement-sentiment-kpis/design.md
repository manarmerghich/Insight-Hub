## Context

Le dashboard (`insight-hub-web/src/app/dashboard/page.tsx`) affiche déjà, sur les messages du dernier run d'import et sous réserve des filtres croisés actifs (`dashboard-cross-filters`) :
- un score de sentiment net à comptage égal + son évolution (`net-sentiment-score.ts`), piloté par le flag `NET_SENTIMENT_SOURCE: "ai" | "csv_original"` (actuellement `"ai"`, la classification IA étant active) ;
- des répartitions par plateforme et par pays (`message-distribution.ts`).

Les messages portent déjà `likes` et `retweets` (`integer`, nullable — CSV source garantit des valeurs numériques mais le champ reste optionnel en base) depuis l'import initial, sans qu'aucun KPI ne les exploite. Ce changement ajoute deux KPIs qui les exploitent, sans introduire de nouveau calcul IA ni de migration de schéma.

Décisions déjà tranchées avec l'utilisateur (voir Decisions) :
- Poids d'engagement d'un message = `likes + retweets`.
- Poids utilisé dans le score pondéré = `1 + likes + retweets` (plancher à 1).
- Taux d'engagement par sentiment restitué comme deux métriques séparées (moyenne des likes, moyenne des retweets), pas une métrique combinée.

## Goals / Non-Goals

**Goals:**
- Restituer, par catégorie de sentiment, la moyenne des likes et la moyenne des retweets des messages classés.
- Restituer un score de sentiment net alternatif, pondéré par l'engagement de chaque message, en complément du score net à comptage égal déjà affiché (ne le remplace pas).
- Respecter les conventions déjà en place : scope au dernier run d'import, respect des filtres croisés, exclusion des messages non classés (`sentiment_status` différent de `completed` en mode `ai`), fraîcheur des données à chaque visite (`dynamic = "force-dynamic"` déjà en place sur la page).

**Non-Goals:**
- Aucun nouveau calcul IA (le sentiment est déjà classé ; ces KPIs sont une restitution/agrégation).
- Aucune modification du score net existant à comptage égal (`net-sentiment-score.ts`) — le score pondéré est un KPI distinct, affiché à côté.
- Aucune pondération par d'autres signaux d'engagement (réponses, partages) — le jeu de données ne fournit que `likes` et `retweets`.
- Aucune bibliothèque de graphiques externe — les cartes existantes utilisent du SVG inline fait main ; ce changement suit la même approche.

## Decisions

### Poids d'engagement = `likes + retweets`, NULL traité comme 0
Les deux KPIs utilisent `coalesce(likes, 0) + coalesce(retweets, 0)` comme mesure d'engagement brute d'un message. Alternative envisagée : moyenne des deux plutôt que somme — écartée par l'utilisateur (la somme correspond littéralement au libellé du PRD "pondéré par likes/retweets" et traite les deux signaux à égalité).

### Score pondéré : poids = `1 + likes + retweets` (plancher à 1)
Pour `engagement-weighted-sentiment-score`, chaque message positif ou négatif contribue à hauteur de `1 + coalesce(likes, 0) + coalesce(retweets, 0)` au numérateur et au dénominateur, plutôt que `likes + retweets` seul. Alternative envisagée : poids réel sans plancher — écartée car (a) elle rendrait un message sans engagement totalement invisible dans le score pondéré alors qu'il l'est dans le score net classique, et (b) un ensemble de messages classés mais tous sans engagement produirait une division par zéro (score indéfini) alors que le score net classique, lui, serait défini sur ce même ensemble — incohérence jugée trompeuse pour l'utilisateur final.

Formule : `score_pondéré = (Σ poids des messages positifs − Σ poids des messages négatifs) / Σ poids des messages positifs+négatifs+neutres`, exprimé en points de pourcentage arrondis, même convention que `net-sentiment-score.ts:computeNetScore`. Les messages neutres comptent dans le dénominateur (poids) mais pas dans le numérateur — même logique que le score net existant.

### Taux d'engagement par sentiment : deux métriques séparées par catégorie
`engagement-rate-by-sentiment` restitue, par catégorie de sentiment, `avgLikes` et `avgRetweets` (moyennes arithmétiques sur les messages de cette catégorie, `NULL` traité comme 0). Alternative envisagée : une métrique combinée (moyenne de `likes + retweets`) — écartée par l'utilisateur au profit de la granularité (un thème peut être beaucoup partagé sans être beaucoup aimé, ou l'inverse ; fusionner les deux signaux masquerait cet écart).

### Réutilisation du flag `NET_SENTIMENT_SOURCE`
Les deux nouveaux modules de requête acceptent le même paramètre de source (`"ai" | "csv_original"`) que `net-sentiment-score.ts` et réutilisent `dashboardFilterConditions(filters, source)` de `dashboard-filters.ts`, plutôt que de coder en dur `"ai"`. Rationale : cohérence avec le module existant, un seul endroit (`NET_SENTIMENT_SOURCE` dans `net-sentiment-score.ts`) pilote la source active pour tous les KPIs de sentiment, aucun risque de désynchronisation si la source change à nouveau.

### Emplacement du code
- `insight-hub-web/src/db/engagement-rate.ts` : `getEngagementRateBySentiment(runId, filters, source)`.
- `insight-hub-web/src/db/weighted-sentiment-score.ts` : `getWeightedSentimentScore(runId, filters, source)`.
- `insight-hub-web/src/app/dashboard/engagement-rate-card.tsx` et `.../weighted-sentiment-card.tsx` : cartes de présentation, même style que `distribution-card.tsx`/`net-sentiment-card.tsx` (classe `card`, pas de bibliothèque de graphiques).
- Câblage dans `page.tsx`, à la suite des cartes déjà affichées (net sentiment, puis répartitions, puis les deux nouvelles cartes).

### Agrégation SQL
Même pattern que l'existant : agrégats Drizzle `sql<number>\`avg(...)\`` / `sum(...)` avec `filter (where ...)`, group by `messages.sentiment`, sur les messages du run + conditions de filtres croisés + `sentiment_status = 'completed'` (mode `ai`) ou mapping `sentiment_original` (mode `csv_original`, même logique que `net-sentiment-score.ts`).

## Risks / Trade-offs

- **[Risque]** Le poids `1 + likes + retweets` peut rendre le score pondéré contre-intuitif si un utilisateur s'attend à une pondération strictement proportionnelle à l'engagement → **Mitigation** : le libellé de la carte explicite la formule (comme le fait déjà la carte du score net avec sa légende), et le design documente le choix comme décision explicite (voir ci-dessus).
- **[Risque]** `avg()` sur un ensemble vide (aucun message classé pour une catégorie de sentiment donnée sous les filtres actifs) retourne `NULL` en SQL → **Mitigation** : traiter comme absence de données pour cette catégorie (catégorie omise ou affichée avec un état vide explicite), jamais 0 trompeur — même convention que le score net (`score indisponible` plutôt que 0).
- **[Risque]** Duplication de logique de mapping `sentiment_original`/`ai` entre trois modules (`net-sentiment-score.ts` et les deux nouveaux) → **Mitigation** : acceptée pour ce changement (les fonctions existantes ne sont pas refactorées en dépendance partagée additionnelle au-delà de ce qui existe déjà — `dashboard-filters.ts`, `original-sentiment-mapping.ts` — pour ne pas élargir le scope de ce changement à un refactor).

## Open Questions

Aucune — les décisions de conception ont été validées avec l'utilisateur avant rédaction (poids d'engagement, plancher, restitution séparée).
