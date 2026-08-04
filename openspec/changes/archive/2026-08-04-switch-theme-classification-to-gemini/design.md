## Context

`app/themes.py` appelait le SDK `anthropic` (`client.messages.create` avec tool use forcé, deux outils distincts : `discover_themes` pour la découverte du référentiel, `classify_theme` pour l'assignation par message) — le seul module du pipeline encore sur Anthropic depuis que `sentiment.py` a basculé sur Gemini (`switch-sentiment-classification-to-gemini`). L'utilisateur souhaite terminer cette bascule pour retirer entièrement la dépendance Anthropic, et supprimer l'appel manuel de classification de thème après import.

## Goals / Non-Goals

**Goals:**
- Remplacer les deux appels IA de `themes.py` (découverte du référentiel, classification par lot) par le SDK `google-genai`, en conservant strictement le même contrat observable : 5 à 8 thèmes découverts une seule fois, un thème assigné par message, traitement par lot resumable, run tracking.
- Retirer la dépendance `anthropic` de `pyproject.toml` une fois qu'aucun module ne l'utilise plus.
- Déclencher automatiquement `run_theme_classification_step` après import, sur le même modèle que `run_sentiment_classification`, en gardant le paramètre `client`/`theme_client` injectable pour les tests.

**Non-Goals:**
- Changer le schéma de base de données ou le référentiel de thèmes déjà découvert (un référentiel existant continue d'être utilisé tel quel, la découverte ne se redéclenche pas).
- Optimiser/comparer la qualité de classification Gemini vs Anthropic pour les thèmes — aucun mécanisme de validation manuelle équivalent à `sentiment-validation-sample` n'existe pour les thèmes ; hors périmètre de ce changement.
- Modifier l'ordre relatif sentiment → thème : le sentiment se déclenche toujours en premier après import, la classification de thème est chaînée immédiatement après.

## Decisions

### Même schéma d'implémentation que `sentiment.py` : `response_json_schema` + `response_mime_type="application/json"`
Réutilisation directe du pattern déjà validé en conditions réelles par le changement précédent : `GenerateContentConfig.response_json_schema` remplace le tool use Anthropic (`DISCOVER_TOOL` → `DISCOVER_SCHEMA`, `build_classify_tool` → `build_classify_schema`), sans `additionalProperties` (non supporté de façon fiable par Gemini), `enum` + `required` suffisant à contraindre la sortie. `response.text` parsé avec `json.loads`, puis chaque entrée validée par appartenance au référentiel de thèmes existant — même logique défensive qu'avec Anthropic (une entrée avec un libellé hors référentiel est ignorée, pas fatale).

### Modèle par défaut : `gemini-flash-lite-latest`, configurable via `GEMINI_THEME_MODEL`
Même choix et même rationale que `GEMINI_SENTIMENT_MODEL` (alias `-latest` plutôt qu'une version épinglée, qui a déjà été rejetée par l'API en conditions réelles pour ce projet). Réutilise la même clé `GEMINI_API_KEY` (un seul compte Gemini, un seul quota gratuit partagé entre sentiment et thèmes).

### Suppression complète de la dépendance `anthropic`
Une fois `themes.py` basculé, plus aucun module du pipeline ne référence le SDK Anthropic (vérifié par recherche dans `insight-hub-pipeline/`). La dépendance est retirée de `pyproject.toml` plutôt que laissée en place « au cas où » — elle serait morte et donnerait une fausse impression de nécessité.

### Déclenchement automatique chaîné après le sentiment, dans la même requête HTTP
Même mécanisme que pour le sentiment (pas d'orchestration durable, choix déjà acté du projet) : `run_import_pipeline` appelle `run_theme_classification_step(client=theme_client)` juste après `run_sentiment_classification`, uniquement si `inserted_count > 0`. `run_theme_classification_step` ne lève jamais d'exception (erreurs capturées et enregistrées sur le run de thème), donc un échec de classification de thème ne peut jamais faire passer un import réussi en erreur — comportement identique à celui déjà spécifié pour le sentiment.

Alternative écartée : déclencher thème et sentiment en parallèle plutôt qu'en séquence. Écartée pour rester cohérent avec l'ordre de dépendances imposé par le PRD (sentiment IA → thèmes IA → synthèse finale) et pour ne pas complexifier `run_import_pipeline` avec de la concurrence alors que le volume par import reste dans le budget de temps interne de chaque étape (45s chacune).

## Risks / Trade-offs

- [Chaîner sentiment et thème dans la même requête HTTP allonge encore la durée totale de `/api/import` (jusqu'à ~90s de budget interne combiné)] → Même mitigation que pour le sentiment : acceptable en développement local, à surveiller au déploiement Vercel ; chaque étape reste resumable, donc un dépassement de durée retarde l'achèvement complet sans perte de données.
- [Le quota gratuit Gemini partagé entre sentiment et thème réduit la marge disponible pour chacun] → Hors contrôle de ce changement ; les deux modèles restent configurables indépendamment (`GEMINI_SENTIMENT_MODEL`, `GEMINI_THEME_MODEL`) si un modèle plus économique ou un fournisseur différent devient nécessaire pour l'un des deux.

## Migration Plan

Pas de migration de données (le référentiel de thèmes déjà découvert reste valide, seul le fournisseur IA change pour les futures classifications). Déploiement : `GEMINI_API_KEY` déjà en place (réutilisée depuis le changement sentiment) ; `GEMINI_THEME_MODEL` optionnelle. `ANTHROPIC_API_KEY` peut être retirée des variables d'environnement du service pipeline. Rollback : revenir à l'implémentation Anthropic de `themes.py` et réajouter la dépendance (git revert), aucune donnée à corriger puisque le format stocké (`theme_id` référençant le référentiel existant) est identique quel que soit le fournisseur.
