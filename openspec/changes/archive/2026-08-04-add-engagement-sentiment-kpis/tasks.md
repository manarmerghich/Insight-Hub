## 1. Taux d'engagement par sentiment (données)

- [x] 1.1 Créer `insight-hub-web/src/db/engagement-rate.ts` avec `getEngagementRateBySentiment(runId, filters)` : agrège, par catégorie de sentiment (mode `NET_SENTIMENT_SOURCE` importé de `net-sentiment-score.ts`, `ai` ou `csv_original`), la moyenne des likes et la moyenne des retweets via `avg(coalesce(likes, 0))`/`avg(coalesce(retweets, 0))`, en composant `dashboardFilterConditions(filters, source)` en plus du scope `runId`
- [x] 1.2 En mode `ai` : `group by messages.sentiment` avec `sentiment_status = 'completed'` ; en mode `csv_original` : regrouper via le mapping de `original-sentiment-mapping.ts` (même logique que `net-sentiment-score.ts` en mode provisoire)
- [x] 1.3 Omettre du résultat toute catégorie sans message classé (pas d'entrée à moyenne 0)
- [x] 1.4 Pas de framework de test JS dans `insight-hub-web` (cohérent avec les modules `db/` existants) : vérification manuelle couverte par 5.1/5.2

## 2. Sentiment pondéré par engagement (données)

- [x] 2.1 Créer `insight-hub-web/src/db/weighted-sentiment-score.ts` avec `getWeightedSentimentScore(runId, filters)` : calcule le poids d'engagement de chaque message comme `1 + coalesce(likes, 0) + coalesce(retweets, 0)`, puis le score net pondéré `(Σ poids positifs − Σ poids négatifs) / Σ poids (positifs+négatifs+neutres)`, arrondi en points de pourcentage (même convention que `computeNetScore` de `net-sentiment-score.ts`)
- [x] 2.2 Réutiliser `NET_SENTIMENT_SOURCE` et `dashboardFilterConditions(filters, source)` pour rester cohérent avec le score net existant (mode `ai` : `sentiment`/`sentiment_status = 'completed'` ; mode `csv_original` : mapping de `sentiment_original`)
- [x] 2.3 Retourner `null` si aucun message classé sous le scope/filtres actifs (jamais 0 par défaut)

## 3. Interface : nouvelles cartes dashboard

- [x] 3.1 Créer `insight-hub-web/src/app/dashboard/engagement-rate-card.tsx` : carte listant, pour chaque catégorie de sentiment restituée, la moyenne des likes et la moyenne des retweets ; état vide explicite si aucune catégorie n'a de message classé
- [x] 3.2 Créer `insight-hub-web/src/app/dashboard/weighted-sentiment-card.tsx` : carte affichant le score pondéré courant (même présentation numérique que `NetScoreValue` dans `net-sentiment-card.tsx`, avec un libellé la distinguant clairement du score net à comptage égal) ; état vide explicite si `null`
- [x] 3.3 Réutiliser les classes CSS déjà définies (`card`, `kicker`, `kpi-value`, `empty-state`) sans ajouter de bibliothèque de graphiques

## 4. Câblage page dashboard

- [x] 4.1 Dans `insight-hub-web/src/app/dashboard/page.tsx`, appeler `getEngagementRateBySentiment(runId, filters)` et `getWeightedSentimentScore(runId, filters)` en parallèle avec les appels existants (`Promise.all`), et rendre les deux nouvelles cartes à la suite des cartes déjà affichées
- [x] 4.2 Vérifier que les deux nouveaux KPIs répondent aux filtres croisés déjà en place (aucun changement requis côté `filter-bar.tsx`, ces KPIs consomment le même `DashboardFilters`)

## 5. Vérification

- [x] 5.1 Exécuter `openspec validate add-engagement-sentiment-kpis --strict` et corriger les éventuels écarts
- [x] 5.2 Tester manuellement avec Playwright : dashboard avec messages classés (les deux cartes affichent des valeurs cohérentes), avec un seul filtre actif, avec plusieurs filtres combinés, avec une combinaison sans résultat (états vides), et sans aucun message importé ; vérifier le rendu responsive
