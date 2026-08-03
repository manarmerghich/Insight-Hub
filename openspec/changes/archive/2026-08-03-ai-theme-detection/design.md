## Context

`ai-sentiment-analysis` est livré : les messages sont reclassés en 3 classes fixes connues à l'avance, par lots resumables, avec run tracking (`sentiment_runs`). Le PRD impose l'étape suivante : détection de thèmes (5-8 max), avant la synthèse finale. Contrairement au sentiment, le référentiel de thèmes n'est pas connu à l'avance — il doit être découvert par l'IA à partir du corpus. Ce changement couvre aussi la restitution "top thèmes/mots-clés" (V1), qui ne fait que lire/trier les thèmes déjà calculés.

Décisions actées avec l'utilisateur avant ce design :
- Référentiel de thèmes **global** (tous mots-clés confondus), pas un référentiel par mot-clé suivi.
- "Mots-clés" de la restitution = le libellé du thème lui-même, pas d'extraction de mots-clés distincte.
- La restitution "top thèmes" est livrée en **API seulement** (pas de nouvelle page dashboard dans ce changement).

## Goals / Non-Goals

**Goals:**
- Découvrir une seule fois un référentiel fixe de 5 à 8 thèmes, représentatif du corpus de messages déjà importés.
- Classer chaque message dans l'un de ces thèmes, par lots resumables, avec run tracking — même schéma opérationnel que `ai-sentiment-analysis`.
- Exposer une lecture triée des thèmes par volume de messages (`top-themes-restitution`), sans nouveau calcul IA.

**Non-Goals:**
- Pas de re-découverte automatique du référentiel (pas de gestion de dérive du corpus dans le temps) — hors périmètre de ce changement.
- Pas de référentiel par mot-clé/marque.
- Pas d'extraction de mots-clés distincte du libellé de thème (nuage de mots par sentiment reste un changement séparé, cf. PRD section D).
- Pas de nouvelle page dashboard ni de composant visuel pour "top thèmes".
- Pas de score de risque réputationnel par thème ni de tendance par thème dans le temps (V2, hors périmètre).

## Decisions

### Référentiel de thèmes : table dédiée, verrouillée après découverte
Une table `themes` (id, label, description, created_at) est peuplée une seule fois par la découverte, puis traitée comme fixe (même logique que l'énumération `positif/négatif/neutre` codée en dur pour le sentiment, sauf que les valeurs sont générées dynamiquement). La classification des messages référence ensuite ce jeu figé de 5 à 8 lignes.
- **Alternative écartée** : stocker le libellé de thème en texte libre directement sur `messages`, sans table dédiée. Rejeté car rien ne garantirait que l'IA réutilise des libellés strictement identiques d'un lot à l'autre (risque d'explosion de variantes du même thème), et casserait la contrainte "5-8 thèmes maximum".

### Découverte bootstrap dans le même endpoint que la classification
`POST /api/themes/runs` (pipeline) vérifie d'abord si `themes` est vide. Si oui, il lance une découverte (échantillon du corpus → appel IA → insertion des 5-8 thèmes) avant d'enchaîner sur la classification des messages en attente, dans la même invocation. Si `themes` contient déjà des lignes, l'étape de découverte est sautée.
- **Alternative écartée** : un endpoint `POST /api/themes/discover` séparé, appelé manuellement avant `POST /api/themes/runs`. Rejeté pour rester cohérent avec le pattern à un seul endpoint déclencheur déjà en place pour le sentiment (`POST /api/sentiment/runs`), et parce que rien ne justifie une étape manuelle distincte pour une opération qui ne s'exécute qu'une fois dans la vie du référentiel.

### Échantillon de découverte plafonné, pas le corpus entier
La découverte envoie à l'IA un échantillon plafonné (`THEME_DISCOVERY_SAMPLE_SIZE`, ex. 200 messages, sélection aléatoire SQL) plutôt que l'intégralité des messages déjà importés.
- **Alternative écartée** : envoyer tout le corpus. Rejeté pour un contrôle de coût/token prévisible, indépendant du volume total importé — un échantillon aléatoire suffit à faire émerger 5-8 thèmes récurrents.

### Classification par lot : tool schema à énumération dynamique, mêmes mécaniques que le sentiment
`classify_theme_batch` construit dynamiquement l'`enum` du tool schema à partir des libellés de `themes` en base (lus une fois par invocation), puis suit exactement le pattern de `sentiment.py` : lots de `BATCH_SIZE`, budget de temps interne, écriture par lot (`theme_status = 'completed'` ou `'error'` par message), run tracking dans `theme_runs`. Le mapping libellé → `theme_id` se fait après réception de la réponse IA, avant l'écriture en base.
- **Alternative écartée** : faire répondre l'IA directement avec un `theme_id` entier. Rejeté car cela obligerait à transmettre les ids dans le prompt/tool schema sans bénéfice — le libellé est plus robuste à une éventuelle réponse mal formée, et le mapping est un simple lookup local.

### Restitution "top thèmes" : requête SQL dans `insight-hub-web`, pas dans le pipeline
Le classement (thème, nombre de messages, part en %) est lu directement par `insight-hub-web` via Drizzle (agrégation SQL group-by sur `messages.theme_id` joint à `themes`), cohérent avec l'architecture actuelle (le pipeline ne fait qu'écrire/orchestrer l'IA, le dashboard lit/agrège). Exposé comme une fonction de requête serveur (et une route API si un futur appelant externe en a besoin), sans page associée dans ce changement.

## Risks / Trade-offs

- **[Risque] Un échantillon de découverte non représentatif produit un référentiel de thèmes de mauvaise qualité, figé ensuite pour tout le corpus.** → Mitigation : plafond de découverte suffisamment large (200 messages) et sélection aléatoire ; accepté comme limite connue du MVP, une re-découverte manuelle restera possible plus tard (hors périmètre ici) en vidant la table `themes`.
- **[Risque] Un message ne correspondant clairement à aucun des 5-8 thèmes force un classement arbitraire.** → Mitigation : suivre le même traitement que le sentiment — si l'IA ne retourne pas de classification exploitable pour un message, celui-ci passe en `theme_status = 'error'` plutôt que d'être forcé dans un thème inadapté.
- **[Trade-off] Référentiel global plutôt que par mot-clé** → Simplicité opérationnelle et cohérence avec le sentiment (déjà global), au prix d'une pertinence analytique moindre si plusieurs mots-clés très différents sont suivis simultanément ; acceptable pour le MVP à un mot-clé principal.

## Migration Plan

- Migration Drizzle additive : nouvelle table `themes`, nouvelle table `theme_runs`, nouvelles colonnes `theme_id` (FK nullable vers `themes`), `theme_status` (défaut `'pending'`), `theme_error` sur `messages`. Aucune colonne existante modifiée ni supprimée.
- Déploiement pipeline : nouveau module `app/themes.py`, nouvelle route `/api/themes/runs`, nouvelle étape dans `app/workflows.py` — additif, n'affecte pas l'import ni la classification de sentiment existants.
- Rollback : purement additif des deux côtés (schéma + code) ; un rollback consiste à ne pas appeler le nouvel endpoint et à ignorer les colonnes/tables ajoutées, sans impact sur le fonctionnement existant.

## Open Questions

Aucune à ce stade — les points d'ambiguïté ont été tranchés avec l'utilisateur avant l'écriture de ce design (périmètre global, sens de "mots-clés", portée API-only).
