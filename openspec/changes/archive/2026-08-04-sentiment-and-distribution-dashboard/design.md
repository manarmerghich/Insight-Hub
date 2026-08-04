## Context

`insight-hub-web` a déjà un module de requête + route API en lecture seule pour le classement des thèmes (`db/theme-ranking.ts` + `api/themes/ranking/route.ts`), mais aucune page dashboard n'existe encore — la seule page applicative est `/import`. `messages` porte déjà `sentiment` / `sentiment_status`, `platform` (non nul) et `country` (nullable), tous alimentés par le pipeline CSV existant. Ce changement lit ces colonnes telles quelles ; aucune migration de schéma n'est nécessaire.

## Goals / Non-Goals

**Goals:**
- Fournir les deux premiers KPIs MVP du PRD (score net + évolution, répartition plateforme/pays) sous forme de visualisations lisibles sur une nouvelle page `/dashboard`.
- Rester purement lecture/agrégation SQL sur les données déjà en base, sans appel IA ni nouvelle colonne.
- Rendre la page utilisable dès le premier import (états vides explicites) plutôt que de supposer un jeu de données déjà riche.
- Afficher par défaut les résultats du dernier import plutôt que l'historique accumulé toutes sessions confondues, pour que le dashboard reflète une session d'analyse plutôt qu'un mélange de runs de test/démo successifs.

**Non-Goals:**
- Filtres croisés interactifs (période, plateforme, pays, sentiment, thème) — item MVP distinct du PRD, hors périmètre ici. Le scope "dernier import" de ce changement est un filtre implicite fixe, pas un contrôle exposé à l'utilisateur ; un futur changement de filtres croisés pourra le rendre configurable (ex. sélectionner un run précédent).
- Comparaison à deux mots-clés, comparaison temporelle période vs période précédente — items V1 distincts.
- Vue d'ensemble "santé de la marque" comme écran agrégeant tous les KPIs — cette page dashboard n'affiche que les deux KPIs de ce changement, d'autres changements y ajouteront des sections.
- Export PDF — hors périmètre.

## Decisions

### Regroupement du calcul en deux modules de requête, miroir de `theme-ranking.ts`
`db/net-sentiment-score.ts` expose `getNetSentimentScore()` (score agrégé + série journalière) ; `db/message-distribution.ts` expose `getPlatformDistribution()` et `getCountryDistribution()`. Chaque fonction fait une seule requête Drizzle avec `count()`/`sum()` conditionnels plutôt que de charger les messages en mémoire pour les agréger côté JS — cohérent avec le pattern déjà en place et scalable indépendamment du volume de messages.

Alternative écartée : une fonction unique `getDashboardData()` qui ferait tout. Rejetée pour rester testable unitairement par KPI, comme le fait déjà `getThemeRanking`.

### Regroupement par jour via `date_trunc('day', timestamp)`
La série d'évolution utilise `messages.timestamp` (date du message, pas `collected_at`) tronqué au jour en SQL (`sql`date_trunc('day', ${messages.timestamp})``), conformément à la granularité journalière imposée par le PRD (section 1.5). Alternative écartée : regrouper côté JS après avoir chargé toutes les lignes — moins performant et redondant avec ce que Postgres fait nativement.

### Pas de nouvelle route API — lecture directe depuis le Server Component
Contrairement à `theme-ranking`, cette page n'a pas besoin de polling client (les KPIs ne changent qu'après un run pipeline, pas en continu) : `dashboard/page.tsx` est un Server Component qui appelle directement les fonctions de `db/`, sans aller-retour HTTP interne. Aucune route `api/` n'est ajoutée par ce changement.

### Visualisations en SVG fait-main, sans nouvelle dépendance de graphique
Aucune bibliothèque de graphiques n'est présente dans `insight-hub-web` (voir `package.json`), et la contrainte projet est de préférer les composants existants à l'ajout de bibliothèques UI. Les deux visualisations demandées (courbe d'évolution, répartitions plateforme/pays) sont simples : une petite courbe SVG faite main pour la série temporelle, et des barres horizontales (composants React + CSS, réutilisant les cartes/variables de couleur déjà définies dans `globals.css`) pour les répartitions. Alternative écartée : ajouter `recharts` ou équivalent — apporterait un poids de bundle et une dépendance non justifiés pour ces deux visuels simples ; à reconsidérer si de futurs KPIs (nuage de mots, carte géographique) exigent un rendu plus complexe.

### Score net exprimé en points de pourcentage, valeur `null` si aucune donnée
`(positifs - négatifs) / total_classé * 100`, arrondi à l'entier le plus proche pour l'affichage. Si `total_classé = 0`, la fonction retourne `null` (voir spec `net-sentiment-score`) et le composant affiche un état vide plutôt qu'un "0" qui laisserait croire à une neutralité mesurée.

### "Non renseigné" comme catégorie de pays à part entière
`country` est nullable en base (contrairement à `platform`, non nul). Plutôt que d'exclure ces messages de la répartition par pays (ce qui fausserait silencieusement les parts), ils sont regroupés sous le libellé "Non renseigné", visible et trié comme les autres catégories.

### "Dernier import" = dernier run ayant des messages, pas la dernière ligne de `import_runs`
Ajouté après un premier test avec de vraies données : la base contient de nombreux runs de test (doublons, mot-clé sans correspondance) avec `retained_count = 0`. Prendre littéralement la ligne `import_runs` la plus récente (id le plus élevé) aurait affiché un dashboard vide alors qu'un import précédent avait bien des résultats exploitables. `db/latest-import-run.ts` fait donc un `INNER JOIN` avec `messages` et prend le run le plus élevé parmi ceux qui ont au moins un message — un run à 0 message n'est jamais retenu comme "dernier import". `getNetSentimentScore`, `getDailyNetSentimentEvolution`, `getPlatformDistribution` et `getCountryDistribution` prennent désormais ce `runId` en paramètre (`null` si aucun run n'a de message, auquel cas elles retournent directement leur état vide sans requêter). La page affiche aussi le mot-clé/fichier/date de ce run pour que l'utilisateur sache quel import est montré.

Alternative écartée : trier `import_runs` par `id` ou `started_at` décroissant sans jointure — plus simple mais incorrect dès qu'un run récent n'a rien retenu, ce qui s'est produit dès le premier test manuel.

### Navigation partagée entre `/import` et `/dashboard`
L'app ayant désormais deux pages, une barre de navigation minimale (`top-nav.tsx`, Client Component pour l'état actif via `usePathname`) est ajoutée dans `layout.tsx`, donc partagée par toutes les pages. Pas de bibliothèque de routing supplémentaire — uniquement `next/link` et `next/navigation`, déjà fournis par Next.js.

### Source provisoire du score net : `sentiment_original` mappé, derrière un flag explicite
L'API Anthropic n'étant pas encore activée (décision utilisateur), `sentiment_status` reste `'pending'` pour tous les messages et le score net/évolution serait perpétuellement vide. `db/net-sentiment-score.ts` expose une constante exportée `NET_SENTIMENT_SOURCE: "ai" | "csv_original"`, actuellement `"csv_original"`, qui bascule le calcul entre les deux sources sans dupliquer la logique de score ni le contrat des fonctions (`getNetSentimentScore`/`getDailyNetSentimentEvolution` gardent la même signature `(runId) => ...`). Le mapping `sentiment_original` → positif/négatif/neutre vit dans `db/original-sentiment-mapping.ts`, une table statique best-effort (le CSV source porte ~190 émotions fines, dont beaucoup ambiguës ou thématiques) : seules les émotions positives/négatives non ambiguës sont énumérées, tout le reste (y compris les futures valeurs inconnues) retombe sur neutre par défaut plutôt que d'être deviné. Le calcul en mode `csv_original` se fait en JS (lecture des lignes brutes puis agrégation) plutôt qu'en SQL, car une expression `CASE` Postgres listant ~140 libellés serait dupliquée et impossible à maintenir en synchronisation avec le mapping TS.

La page dashboard affiche un bandeau (teinte Warning du design system) tant que `NET_SENTIMENT_SOURCE === "csv_original"`, indiquant explicitement que le score n'est pas issu d'une classification IA. Repasser le flag à `"ai"` une fois l'API activée fait immédiatement revenir au calcul officiel (`sentiment`/`sentiment_status = 'completed'`) déjà implémenté et testé, sans autre changement de code.

Alternative écartée : supprimer/remplacer le code du mode "ai" par le mode CSV. Rejetée pour ne pas perdre une implémentation déjà conforme au PRD ni devoir la réécrire lors de l'activation de l'IA — la bascule doit rester un changement d'une ligne (le flag), pas une réimplémentation.

**Mise à jour** : la classification IA (Gemini) a été activée et vérifiée en conditions réelles (voir `switch-sentiment-classification-to-gemini`). `NET_SENTIMENT_SOURCE` est repassé à `"ai"` exactement comme prévu ici — aucune autre modification de code nécessaire. Le mode `csv_original` et son bandeau d'avertissement restent dans le code, inactifs, en secours si l'IA redevenait indisponible.

### Rendu toujours dynamique (`export const dynamic = "force-dynamic"`)
Maintenant que la classification de sentiment se déclenche automatiquement en tâche de fond après chaque import (voir `switch-sentiment-classification-to-gemini`), l'utilisateur peut arriver sur `/dashboard` à tout moment après qu'un import a terminé, sans action manuelle entre les deux. `dashboard/page.tsx` interroge la base directement (pas de `fetch`), donc le cache de données de Next.js ne s'applique pas nativement ; mais le rendu de la page elle-même pourrait être optimisé statiquement par Next.js en production sans ce garde-fou explicite. `export const dynamic = "force-dynamic"` force une lecture à la demande à chaque visite, pour que la page ne serve jamais un rendu pré-calculé antérieur à la dernière classification.

Alternative écartée : ne rien faire, en comptant sur le comportement par défaut de `next dev` (qui ne met rien en cache). Rejetée : correct uniquement en développement local, pas une garantie pour un déploiement Vercel réel — ce changement doit tenir la promesse "toujours affiché sans action supplémentaire" indépendamment de l'environnement.

## Risks / Trade-offs

- [Volume de jours dans la série d'évolution peut devenir long sur un historique étendu, rendant la courbe SVG faite main dense] → Acceptable pour le MVP (granularité journalière, historique de import CSV limité en pratique) ; réévaluer un lissage/agrégation par semaine si le volume de jours devient un problème réel.
- [Pas de bibliothèque de graphiques réutilisable pour les futurs KPIs visuels (nuage de mots, carte géographique, etc.)] → Décision volontairement scopée à ce changement ; un futur changement pourra introduire une dépendance dédiée si les visuels à venir le justifient, sans que ce choix ne soit remis en cause rétroactivement ici.
- [Le scope "dernier import" est fixe et non configurable : impossible de revoir un run précédent depuis le dashboard] → Acceptable pour le MVP (cohérent avec le non-goal "filtres croisés") ; un futur changement pourra exposer un sélecteur de run si le besoin se confirme.
- [Le mapping `sentiment_original` → 3 catégories est un heuristique approximatif (émotions ambiguës/thématiques classées neutres par défaut), donc le score provisoire peut diverger significativement du futur score IA] → Assumé et communiqué explicitement via le bandeau d'avertissement sur le dashboard ; ce n'est pas un risque caché puisque le score est marqué comme non officiel.
- [Oublier de repasser `NET_SENTIMENT_SOURCE` à `"ai"` après activation de la classification IA laisserait le dashboard afficher un score provisoire alors qu'une vraie classification est disponible] → **Résolu** : repassé à `"ai"` et vérifié en conditions réelles (voir `switch-sentiment-classification-to-gemini`).

## Migration Plan

Aucune migration de schéma. Déploiement direct : nouveaux fichiers `db/`, nouvelle route de page `/dashboard`, aucun changement de comportement sur les pages existantes. Rollback = retrait des fichiers ajoutés, sans impact sur les données.

## Open Questions

Aucune à ce stade — le périmètre est entièrement dérivé de données déjà persistées.
