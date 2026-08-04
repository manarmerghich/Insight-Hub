## 1. Score de sentiment net (données)

- [x] 1.1 Créer `insight-hub-web/src/db/net-sentiment-score.ts` avec `getNetSentimentScore()` : calcule, sur les messages `sentiment_status = 'completed'`, le score net agrégé ((positifs − négatifs) / total, en points de pourcentage arrondis), `null` si aucun message classé
- [x] 1.2 Dans le même module, calculer la série journalière (`date_trunc('day', timestamp)`) : un point par jour ayant au moins un message classé, avec positifs/négatifs/neutres/total/score net de ce jour, triée par date croissante
- [x] 1.3 Pas de framework de test JS dans `insight-hub-web` (décision utilisateur, cohérent avec `theme-ranking.ts` qui n'en a pas non plus) : vérification manuelle couverte par 4.1/4.2 et par les tests live finaux (sunset/tea/ice) — scores positifs et négatifs réels observés

## 2. Répartition plateforme et pays (données)

- [x] 2.1 Créer `insight-hub-web/src/db/message-distribution.ts` avec `getPlatformDistribution()` : compte et part par plateforme distincte, triés par volume décroissant
- [x] 2.2 Dans le même module, `getCountryDistribution()` : compte et part par pays distinct, messages sans pays regroupés sous "Non renseigné", triés par volume décroissant
- [x] 2.3 Pas de framework de test JS (même décision qu'en 1.3) : vérification manuelle couverte par 4.1/4.2 et par les tests live finaux — totaux plateforme/pays confirmés correspondre exactement aux nouveaux messages de chaque run (sunset, tea, ice)

## 3. Page dashboard

- [x] 3.1 Créer `insight-hub-web/src/app/dashboard/page.tsx` (Server Component) qui appelle directement les fonctions des modules 1 et 2, sans route API intermédiaire
- [x] 3.2 Créer le composant de KPI score net (chiffre courant + état vide si `null`), en respectant la palette existante (`globals.css`) : teinte Success/Error selon le signe, jamais de texte blanc sur fond plein pour ces états
- [x] 3.3 Créer le composant courbe d'évolution (SVG fait main, pas de nouvelle dépendance de graphique) affichant la série journalière, avec état vide explicite si la série est vide
- [x] 3.4 Créer le composant de répartition par plateforme (barres horizontales triées par volume, réutilisant les cartes existantes), avec état vide si aucun message importé
- [x] 3.5 Créer le composant de répartition par pays (même pattern que 3.4), incluant la catégorie "Non renseigné"
- [x] 3.6 ~~Vérifié `layout.tsx` : aucune navigation existante dans l'app (une seule page avant ce changement) — rien à y ajouter~~ Revu en tâche 5.1 suite à une demande utilisateur post-implémentation : une navigation a finalement été ajoutée.

## 4. Vérification

- [x] 4.1 Lancer l'app localement, vérifier le rendu du dashboard avec des données réelles importées (score net, courbe, répartitions) — vérifié contre la base Neon réelle (51 messages, répartitions plateforme/pays correctes) ; courbe/KPI (positif et négatif) vérifiés avec une série simulée le temps du test, base réelle n'ayant pas encore de message `sentiment_status = 'completed'`
- [x] 4.2 Vérifier le rendu des états vides (base sans message classé / sans message importé) sans erreur — confirmé : score et courbe affichent leur état vide tant qu'aucun message n'a `sentiment_status = 'completed'`
- [x] 4.3 Tester avec Playwright : page responsive, visualisations lisibles en desktop et mobile, contrastes conformes à la palette définie — vérifié à 1280px et 390px ; a révélé et corrigé un bug (barres de répartition invisibles, `<span>` inline sans `display: block`)

## 5. Navigation et scope "dernier import" (ajouts post-implémentation)

- [x] 5.1 Créer `insight-hub-web/src/app/top-nav.tsx` (Client Component, lien actif via `usePathname`) et l'inclure dans `layout.tsx` pour naviguer entre `/import` et `/dashboard`
- [x] 5.2 Créer `insight-hub-web/src/db/latest-import-run.ts` avec `getLatestImportRun()` : run le plus élevé (par id) parmi ceux ayant au moins un message (`INNER JOIN messages`), retourne `null` si aucun run n'a de message
- [x] 5.3 Ajouter un paramètre `runId: number | null` à `getNetSentimentScore`, `getDailyNetSentimentEvolution`, `getPlatformDistribution`, `getCountryDistribution` ; filtrer sur `messages.run_id = runId` et retourner l'état vide directement si `runId` est `null`
- [x] 5.4 Mettre à jour `dashboard/page.tsx` pour récupérer `getLatestImportRun()` une fois, passer son `id` aux quatre fonctions, et afficher un bandeau indiquant l'import affiché (mot-clé, fichier, date)
- [x] 5.5 Vérifier contre la base réelle : confirmer qu'un run récent à 0 message (doublons/aucune correspondance) est bien ignoré au profit du run précédent ayant des messages, et que les totaux affichés correspondent au `retained_count` de ce run

## 6. Source provisoire du score net (sentiment_original, en attendant l'activation IA)

- [x] 6.1 Créer `insight-hub-web/src/db/original-sentiment-mapping.ts` : mapping best-effort des émotions brutes du CSV vers positif/négatif/neutre (défaut neutre pour toute valeur non énumérée), basé sur les ~190 valeurs distinctes du CSV source
- [x] 6.2 Ajouter la constante exportée `NET_SENTIMENT_SOURCE` (`"ai" | "csv_original"`, actuellement `"csv_original"`) dans `db/net-sentiment-score.ts`, et brancher `getNetSentimentScore`/`getDailyNetSentimentEvolution` sur cette source sans changer leur signature ni supprimer le calcul IA existant
- [x] 6.3 Ajouter un prop `source` à `NetSentimentCard` affichant un bandeau (teinte Warning) quand la source est `"csv_original"`, indiquant clairement que le score n'est pas issu d'une classification IA
- [x] 6.4 Vérifier contre la base réelle : recalculer indépendamment (script) le score attendu à partir de `sentiment_original` pour le dernier run et comparer au score affiché sur le dashboard

## 7. Bascule vers le mode IA officiel (classification Gemini activée)

- [x] 7.1 Repasser `NET_SENTIMENT_SOURCE` de `"csv_original"` à `"ai"` dans `net-sentiment-score.ts`, une fois la classification Gemini confirmée fonctionnelle en conditions réelles (voir `switch-sentiment-classification-to-gemini`)
- [x] 7.2 Ajouter `export const dynamic = "force-dynamic"` à `dashboard/page.tsx` pour garantir une lecture toujours fraîche, la classification se déclenchant désormais automatiquement en tâche de fond après import
- [x] 7.3 Vérification live réelle : import du mot-clé `sunset` via l'UI (`/import`, 9 nouveaux messages), classification automatique, puis visite de `/dashboard` sans aucune action manuelle — score net réel affiché immédiatement (+56 pts), bandeau provisoire absent, cohérent avec 7 positif / 2 négatif sur 9 messages
