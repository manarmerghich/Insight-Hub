## Context

`net-sentiment-score` calcule déjà, à la demande et sans cache, la série `DailyNetSentiment[]` (une entrée par jour calendaire ayant au moins un message classé, avec `netScore`) via `getDailyNetSentimentEvolution`, affichée par `EvolutionChart` dans `net-sentiment-card.tsx` sous forme de courbe SVG dessinée à la main. Le PRD prévoit une détection de pics *a posteriori* sur cette timeline — une annotation visuelle des jours où le score s'écarte significativement de la moyenne — explicitement non configurable et sans alerte active (email/Slack exclus, cf. PRD section E). C'est une capacité de pure restitution : elle post-traite une série déjà calculée, sans appel IA supplémentaire ni nouvelle colonne stockée.

## Goals / Non-Goals

**Goals:**
- Détecter, à la volée, les jours de la série déjà affichée dont le score net s'écarte significativement de la moyenne de la période affichée.
- Annoter visuellement ces jours sur la courbe existante, en distinguant pic positif / pic négatif.
- Pour chaque pic, fournir un chiffre (score du jour), une comparaison (écart à la moyenne) et un exemple concret (message représentatif du jour) — conformément à la règle PRD de l'insight actionnable.
- Rester cohérent avec `net-sentiment-score` : recalcul systématique à chaque visite, mêmes filtres croisés, même run d'import.

**Non-Goals:**
- Aucun seuil configurable par l'utilisateur (PRD : exclu).
- Aucune notification/alerte active (email, Slack) ni persistance d'un historique d'alertes.
- Aucun nouveau calcul IA, aucune nouvelle table ni colonne en base, aucune migration Drizzle.
- Aucune détection de pics multi-métriques (thème, engagement) — uniquement le score net déjà restitué par `net-sentiment-score`.

## Decisions

**Calcul en mémoire, côté serveur, sur la série déjà chargée.** La détection s'exécute en JavaScript sur le tableau `DailyNetSentiment[]` déjà retourné par `getDailyNetSentimentEvolution` (au plus quelques centaines de points, un par jour), plutôt qu'en SQL. Alternative écartée : calculer moyenne/écart-type en SQL (agrégat séparé) — inutile ici car la série est déjà en mémoire et sa taille est négligeable ; garder le calcul en JS évite une requête supplémentaire et garde toute la logique de "restitution" dans une seule fonction pure et testable.

**Seuil fixe à 2 écarts-types, calculé sur la période affichée.** Un jour est un pic si `|netScore_jour − moyenne| > 2 × écart-type`, moyenne et écart-type (population, pas échantillon) calculés sur l'ensemble des jours de la série actuellement retournée (donc déjà restreinte par les filtres croisés actifs, y compris la période). Alternative écartée : seuil configurable par l'utilisateur — explicitement exclu par le PRD ("pas de seuils configurables"). Alternative écartée : seuil basé sur une fenêtre glissante — plus complexe, non demandé, et incohérent avec le fait que la série elle-même est déjà bornée par le filtre de période actif.

**Taille minimale de série : 5 jours.** En dessous de 5 jours avec données, aucun pic n'est signalé : une moyenne/écart-type sur 2-4 points n'est pas statistiquement significative et produirait des pics artificiels ou absents de façon incohérente. Alternative écartée : toujours calculer, même sur 2 points — rejetée car un écart-type sur si peu de points est trompeur et contredit la garantie PRD "toujours un chiffre + une comparaison" fiable.

**Écart-type nul → aucun pic.** Si tous les jours ont exactement le même score net (écart-type = 0), aucun jour ne peut mathématiquement dépasser le seuil (toute déviation vaut 0), donc aucun pic n'est signalé — comportement naturel de la formule, pas de cas particulier à coder, mais explicitement documenté comme tel.

**Exemple concret = message le plus engageant du jour, dans la catégorie dominante.** Pour un pic positif, l'exemple est le message du jour classé positif avec le plus grand `likes + retweets` (null traité comme 0, même convention que `engagement-rate-by-sentiment`) ; pour un pic négatif, le message négatif le plus engageant. Alternative écartée : premier message chronologique du jour — moins représentatif du poids réel de l'événement. Réutilise une convention déjà actée dans le codebase (`engagement-rate-by-sentiment`) plutôt que d'introduire un nouveau critère.

**Annotation visuelle intégrée à `EvolutionChart` existant, pas un nouveau composant de graphique.** Les marqueurs de pic sont ajoutés au SVG déjà dessiné à la main dans `net-sentiment-card.tsx`, en réutilisant les jetons de couleur existants (`--color-success` pour positif, `--color-error` pour négatif). Alternative écartée : introduire une bibliothèque de charting — proscrit par la contrainte projet "préférer les composants existants plutôt que d'ajouter de nouvelles bibliothèques UI".

## Risks / Trade-offs

- [Risque] Une série courte (< 5 jours) n'affichera jamais de pic, même si un jour est visuellement très différent des autres → Mitigation : comportement documenté explicitement dans la spec, cohérent avec le principe "pas de chiffre trompeur" du PRD ; un utilisateur peut élargir la période pour obtenir plus de jours.
- [Risque] Un jour extrême peut lui-même gonfler l'écart-type de la période et masquer sa propre détection (ou celle de jours voisins) — limite connue de l'écart-type population sur petite série → Mitigation : acceptée comme compromis simple, conforme au PRD qui exclut explicitement toute configuration avancée ; documenté comme non-goal (pas de détection statistique robuste de type MAD/IQR).
- [Risque] Le message le plus "engageant" (likes+retweets) n'est pas toujours le plus représentatif du contenu du pic (ex. message viral hors-sujet) → Mitigation : compromis déjà accepté ailleurs dans le projet (`engagement-rate-by-sentiment`), pas un nouveau risque introduit par ce changement.

## Migration Plan

Aucune migration de base de données. Déploiement standard : nouvelle fonction pure de détection + extension du composant d'affichage existant, livrés ensemble. Rollback : retirer l'appel à la fonction de détection et les marqueurs visuels ; `net-sentiment-score` continue de fonctionner à l'identique puisqu'il n'est pas modifié.
