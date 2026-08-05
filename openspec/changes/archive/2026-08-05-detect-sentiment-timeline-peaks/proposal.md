## Why

La timeline du score de sentiment net (`net-sentiment-score`) affiche déjà l'évolution jour par jour, mais un responsable marketing doit repérer lui-même les jours anormaux en scrutant la courbe. Le PRD prévoit une détection de pics *a posteriori* (annotation visuelle des jours où le score s'écarte significativement de la moyenne, jamais une alerte active) : c'est la brique suivante dans la chaîne de dépendances, juste après le Sentiment Score net déjà livré.

## What Changes

- Calcul, à la volée et côté serveur, de la moyenne et de l'écart-type du score net journalier sur la série déjà retournée par `getDailyNetSentimentEvolution` (aucun nouvel appel IA, aucune nouvelle colonne stockée).
- Marquage de chaque jour de la série comme "pic" lorsque son score net s'écarte significativement de la moyenne de la période affichée (au-delà d'un seuil statistique simple, ex. 2 écarts-types), avec distinction pic positif / pic négatif.
- Annotation visuelle des jours marqués sur la courbe existante (`EvolutionChart` dans `net-sentiment-card.tsx`) : marqueur visuellement différencié + le chiffre du jour, la comparaison à la moyenne, et un exemple concret de message représentatif de ce jour (cohérent avec la règle PRD "toujours un chiffre + une comparaison + un exemple").
- Recalcul systématique à chaque consultation, sans mise en cache d'un ancien calcul, pour rester cohérent avec le reste du KPI `net-sentiment-score`.
- Aucune configuration de seuil par l'utilisateur, aucune notification (email/Slack) : uniquement une restitution visuelle passive dans le dashboard, conformément au PRD (section E, Alerting exclu).

## Capabilities

### New Capabilities
- `sentiment-timeline-peak-detection` : détection a posteriori et annotation visuelle des jours de pic sur la timeline du score de sentiment net.

### Modified Capabilities
(aucune — le calcul du score net et de son évolution au jour le jour, définis dans `net-sentiment-score`, ne changent pas de comportement ; cette capacité consomme la série existante sans en modifier les Requirements.)

## Impact

- `insight-hub-web/src/db/net-sentiment-score.ts` : nouvelle fonction de détection de pics appliquée à la série déjà calculée par `getDailyNetSentimentEvolution` (pure restitution statistique, pas de requête IA).
- `insight-hub-web/src/app/dashboard/net-sentiment-card.tsx` (`EvolutionChart`) : ajout des marqueurs visuels de pic et de leur info-bulle (chiffre, écart à la moyenne, exemple de message).
- `insight-hub-web/src/app/dashboard/page.tsx` : passage des messages représentatifs du jour au composant, si nécessaire pour citer un exemple concret par pic.
- Aucun changement de schéma Neon, aucune migration Drizzle, aucun nouvel appel Anthropic/Gemini.
