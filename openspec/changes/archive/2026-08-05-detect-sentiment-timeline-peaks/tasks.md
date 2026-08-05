## 1. Détection statistique des pics

- [x] 1.1 Créer `insight-hub-web/src/db/sentiment-timeline-peaks.ts` avec une fonction pure `detectNetSentimentPeaks(evolution: DailyNetSentiment[])` calculant moyenne et écart-type (population) sur la série reçue
- [x] 1.2 Appliquer le seuil de 2 écarts-types et la taille minimale de 5 jours (aucun pic si < 5 jours ou écart-type nul), retournant pour chaque jour marqué un objet incluant sa direction (`positive`/`negative`) et son écart à la moyenne
- [x] 1.3 Écrire des tests unitaires couvrant : série < 5 jours, série sans dispersion, pic positif, pic négatif, jour dans la plage normale

## 2. Message représentatif par pic

- [x] 2.1 Ajouter une requête (dans `sentiment-timeline-peaks.ts` ou `net-sentiment-score.ts`) récupérant, pour un jour et une catégorie de sentiment donnés, le message du même run d'import et des mêmes filtres croisés avec la plus grande somme `likes + retweets` (null traité comme 0), départage par id croissant en cas d'égalité
- [x] 2.2 Relier cette requête aux jours marqués comme pics pour produire, pour chaque pic, le texte et les métadonnées (auteur, plateforme, date) du message représentatif

## 3. Intégration dashboard

- [x] 3.1 Dans `insight-hub-web/src/app/dashboard/page.tsx`, appeler la détection de pics sur `evolution` déjà chargée et passer le résultat à `NetSentimentCard`
- [x] 3.2 Dans `net-sentiment-card.tsx` (`EvolutionChart`), ajouter un marqueur visuel distinct par pic (couleur `--color-success` pour positif, `--color-error` pour négatif) sur la courbe SVG existante
- [x] 3.3 Afficher, au survol/sélection d'un marqueur, le score net du jour, son écart à la moyenne de la période affichée, et le message représentatif (texte + auteur/plateforme/date)
- [x] 3.4 Vérifier le rendu quand aucun pic n'est détecté (série trop courte, écart-type nul, ou aucun jour hors seuil) : la courbe s'affiche normalement sans marqueur ni erreur

## 4. Vérification

- [x] 4.1 Tester manuellement avec Playwright : dashboard avec pics visibles, dashboard sans pic, changement de filtres croisés (période notamment) recalculant les pics, responsive et contraste WCAG AA des marqueurs
- [x] 4.2 Confirmer qu'aucune requête IA supplémentaire n'est déclenchée et qu'aucune donnée de pic n'est persistée en base
