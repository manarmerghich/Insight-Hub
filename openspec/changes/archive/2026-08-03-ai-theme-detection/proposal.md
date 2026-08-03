## Why

Le sentiment IA est en place ; le PRD impose l'ordre sentiment → thèmes → synthèse. Sans détection de thèmes, aucun des KPIs qui en dépendent (top thèmes/mots-clés, score de risque par thème, tendance par thème, filtres croisés par thème) ne peut avancer. Ce changement livre la donnée structurée de thème par message (MVP) ainsi que la restitution "top thèmes/mots-clés" (V1), pour rester sur l'ordre de construction imposé.

## What Changes

- Nouvelle étape de **découverte du référentiel de thèmes** : au premier déclenchement, l'IA (SDK Anthropic) analyse un échantillon représentatif du corpus de messages pour produire une liste fixe de 5 à 8 thèmes (libellé + courte description), persistée une seule fois en base comme référentiel global (tous mots-clés confondus).
- Nouvelle étape de **classification de thème par message** : chaque message en attente (`theme_status = 'pending'` ou `'error'`) est assigné à l'un des thèmes du référentiel via un appel IA par lot, selon le même schéma que la classification de sentiment existante (traitement resumable par invocation, budget de temps interne, run consultable).
- Nouvelle capacité de **restitution "top thèmes/mots-clés"** : lecture seule qui trie les thèmes déjà calculés par volume de messages (le libellé de thème tient lieu de mot-clé), sans nouveau calcul IA. Exposée en API uniquement pour ce changement — pas de nouvelle page dashboard.
- Nouveaux objets de données : table `themes` (référentiel fixe), colonnes `theme_id` / `theme_status` / `theme_error` sur `messages`, table `theme_runs` (suivi des invocations de classification).
- Nouvel endpoint pipeline `POST /api/themes/runs` : si le référentiel de thèmes n'existe pas encore, le déclenche (découverte) avant de lancer la classification des messages en attente ; sinon classe directement avec le référentiel existant.

## Capabilities

### New Capabilities
- `ai-theme-detection`: découverte d'un référentiel global de 5 à 8 thèmes via le SDK Anthropic, puis classification de chaque message dans l'un de ces thèmes, avec suivi de run resumable — miroir de `ai-sentiment-analysis` pour les thèmes.
- `top-themes-restitution`: lecture seule qui classe les thèmes existants par volume de messages (API), sans déclenchement de calcul IA.

### Modified Capabilities
(aucune — pas de changement de comportement des specs existantes)

## Impact

- `insight-hub-pipeline/app/` : nouveau module `themes.py` (miroir de `sentiment.py`), ajouts dans `db.py` (création/lecture du référentiel, run tracking), ajout d'une étape dans `workflows.py`, nouvelle route dans `api/index.py`.
- `insight-hub-web/src/db/schema.ts` : nouvelles tables `themes`, `theme_runs`, nouvelles colonnes sur `messages` (`theme_id`, `theme_status`, `theme_error`), migration Drizzle associée.
- Tests pipeline : nouveaux tests unitaires/intégration miroir de ceux de `sentiment.py`.
