## Context

Le dashboard restitue déjà, par thème, un classement par volume (`top-themes-restitution`, `src/db/theme-ranking.ts`) et, globalement (tous thèmes confondus), une comparaison temporelle du score de sentiment net vs la période précédente équivalente (`net-sentiment-temporal-comparison`, `previousPeriodFilters` dans `src/db/dashboard-filters.ts`). Ce change combine ces deux mécaniques déjà en place, appliquées à un nouveau chiffre composite par thème, sans nouveau calcul IA ni nouvelle colonne de schéma : uniquement de l'agrégation SQL sur `messages.theme_id`, `messages.theme_status`, `messages.sentiment`, `messages.sentiment_status`.

## Goals / Non-Goals

**Goals:**
- Calculer un score de risque réputationnel par thème = part de volume × part de négatif, exprimé sur une échelle 0-100, à partir des messages déjà classés (thème + sentiment) du dernier run d'import.
- Calculer la tendance de ce score par thème (delta vs période précédente équivalente), réutilisant `previousPeriodFilters`.
- Restituer les deux dans un seul widget dashboard (une ligne par thème : score courant + tendance), respectant les filtres croisés actifs sauf la dimension thème (même exception que `top-themes-restitution`).

**Non-Goals:**
- Pas de nouveau calcul IA, pas de nouvelle notion d'« intensité » au-delà de la part de négatif déjà classée (pas de score de sévérité, pas de pondération par engagement — cf. `engagement-weighted-sentiment-score` qui est un KPI séparé et non réutilisé ici).
- Pas de série temporelle journalière par thème (sparkline) : la tendance se limite à un delta à deux points (courant vs période précédente), comme pour `net-sentiment-temporal-comparison`.
- Pas de seuil d'alerte ni de notification (hors périmètre PRD : pas d'alerting automatique).

## Decisions

### 1. Formule du score : part de volume × part de négatif (et non volume brut × part de négatif)
`riskScore(theme) = (messageCount(theme) / totalMessagesClassifiés) × (negativeCount(theme) / messageCount(theme)) × 100`

- Alternative rejetée : `volume brut × part de négatif`. Cette formule se simplifie algébriquement en `negativeCount(theme)` pur (si les deux dénominateurs sont identiques), donc n'apporte rien de plus qu'un tri par nombre brut de messages négatifs — moins parlant qu'un score normalisé et confirmé par l'utilisateur comme le comportement voulu (un gros thème modérément négatif doit pouvoir dominer un petit thème très négatif).
- Le score reste borné 0-100 et peut se lire comme « part de risque que ce thème représente dans le volume négatif pondéré global », cohérent avec les autres pourcentages déjà affichés sur le dashboard (`net-sentiment-score`, `top-themes-restitution`).

### 2. Périmètre de comptage : intersection theme_status='completed' ET sentiment_status='completed'
Un message doit avoir les deux classifications terminées pour entrer dans `messageCount(theme)` et dans `totalMessagesClassifiés` (le dénominateur de la part de volume). Un message avec thème classé mais sentiment encore `pending`/`error` (ou l'inverse) est exclu des deux calculs, plutôt que de fausser soit la part de volume soit la part de négatif avec un dénominateur incohérent entre les deux facteurs de la formule.

- Conséquence : `totalMessagesClassifiés` peut être inférieur au total de messages du run (cf. `ai-theme-detection` et `ai-sentiment-analysis`, deux pipelines indépendants pouvant avancer à des rythmes différents).
- Un thème sans message dans ce périmètre apparaît avec un score de `0` (comme `top-themes-restitution` affiche `0` plutôt que d'omettre le thème), sauf si `totalMessagesClassifiés = 0` pour l'ensemble des thèmes, auquel cas le widget affiche son état vide global.

### 3. Réutilisation de `dashboardFilterConditions(..., { includeTheme: false })` et exception filtre thème
Comme `theme-ranking.ts`, ce nouveau module ignore la dimension de filtre croisé thème (sinon sélectionner un thème réduirait le classement à une seule ligne, ce qui n'a pas de sens pour un KPI comparatif inter-thèmes). Les autres dimensions (période, plateforme, pays, sentiment) s'appliquent normalement. Ceci nécessite une modification de la capacité `dashboard-cross-filters` (delta spec) pour étendre l'exception déjà documentée pour `top-themes-restitution` à ce nouveau widget.

### 4. Tendance : réutilisation directe de `previousPeriodFilters`
Le delta par thème = `riskScore(theme, filtres courants) − riskScore(theme, previousPeriodFilters(filtres courants))`, calculé uniquement quand `previousPeriodFilters` retourne une fenêtre valide (donc seulement si `dateFrom`/`dateTo` sont actifs et complets — sinon la tendance est absente, comme pour le score net global). Aucune agrégation indépendante : même fonction de calcul de score appelée deux fois avec des filtres différents (période courante, période précédente), à l'identique du pattern déjà en place pour `net-sentiment-score`.

- **Sens du delta inversé par rapport au score net** : pour le score net, une hausse est une amélioration. Pour un score de *risque*, une **baisse** est une amélioration et une **hausse** est une dégradation. Le composant d'affichage doit donc inverser la logique de couleur/icône déjà utilisée par `net-sentiment-card.tsx` (ne pas réutiliser le même sens de comparaison tel quel).
- Si le score précédent d'un thème est `0` par absence de message classé sur la période précédente (cf. Decision 2) alors que le score courant est `> 0`, le delta est affiché normalement (le thème n'existait simplement pas encore dans ce périmètre) plutôt que masqué — différent du cas `net-sentiment-score` où un score `null` (absence totale de donnée) bloque l'affichage : ici, `0` est une valeur significative (aucun message classé pour ce thème sur cette fenêtre), pas une absence de mesure.

### 5. Un seul widget combiné plutôt que deux cartes séparées
Le score et sa tendance sont rendus dans le même composant (`theme-risk-score-card.tsx`), une ligne par thème avec deux colonnes (score, tendance), pour rester lisible comme un tableau de priorisation unique — cohérent avec la formulation « deux KPIs liés » du besoin.

## Risks / Trade-offs

- **[Risque] Score peu intuitif à l'échelle 0-100 sans repère fixe** (contrairement à un pourcentage simple) → Mitigation : accompagner l'affichage d'une info-bulle/texte explicatif reprenant la formule en langage clair, et toujours afficher volume + part de négatif bruts à côté du score composite (l'insight actionnable du PRD exige un chiffre + un exemple/contexte, pas un score opaque seul).
- **[Risque] Dénominateurs theme vs sentiment désynchronisés en cours de pipeline** (classification thème et sentiment asynchrones) → Mitigation déjà couverte par Decision 2 (intersection stricte), au prix d'un score temporairement sous-estimé tant que les deux pipelines ne sont pas alignés ; acceptable car recalculé à chaque visite (`force-dynamic`, comme le reste du dashboard).
- **[Trade-off] Pas de sparkline journalière** → moins riche visuellement qu'une courbe par thème, mais évite d'ajouter un nouveau type de visualisation (8 mini-courbes) pour un gain marginal vs un delta à deux points, décision validée avec l'utilisateur.

## Migration Plan

Aucune migration de schéma ni de données. Ajout de code pur (module de calcul + composant + branchement dans `page.tsx`), déployé comme les changes précédents (pas de flag de rollout, la fonctionnalité apparaît immédiatement sur le dashboard).
