## Context

`app/sentiment.py` appelait le SDK `anthropic` (`client.messages.create` avec `tools=[CLASSIFY_TOOL]` en tool use forcé) pour classer chaque message en 3 classes. L'utilisateur veut éviter tout coût API pendant cette phase et a choisi Gemini pour son palier gratuit permanent sans carte bancaire. `app/themes.py` (détection de thèmes) utilise aussi le SDK Anthropic mais reste hors périmètre — seul `sentiment.py` est concerné par cette demande.

## Goals / Non-Goals

**Goals:**
- Remplacer l'appel IA de `sentiment.py` par le SDK `google-genai`, en conservant strictement le même contrat observable : 3 classes (`positif`/`négatif`/`neutre`), un résultat par message, traitement par lot resumable, run tracking, jamais d'usage de `sentiment_original` en entrée.
- Garder `run_classification`, `classify_batch`, `fetch_pending_messages`, `write_batch_results` avec les mêmes signatures, pour que `app/workflows.py` et les tests d'intégration n'aient rien à changer au-delà du client injecté.

**Non-Goals:**
- Migrer `app/themes.py` vers Gemini — non demandé, reste sur Anthropic.
- Changer le schéma de base de données ou les valeurs stockées (`positif`/`négatif`/`neutre` restent en français, inchangées).
- Optimiser/comparer la qualité de classification Gemini vs Anthropic — l'échantillon de validation manuelle (`sentiment-validation-sample`) existant reste le mécanisme pour mesurer l'accord, inchangé par ce changement.

## Decisions

### SDK `google-genai` (Gemini Developer API), pas `google-generativeai`
`google-generativeai` est l'ancien SDK, en dépréciation (bug fixes uniquement) au profit de `google-genai`, le SDK actuel recommandé (vérifié via la documentation à jour du SDK, package installé en 2.16.0). `genai.Client()` sans argument lit automatiquement `GEMINI_API_KEY` depuis l'environnement, symétrique à `anthropic.Anthropic()`.

### Sortie structurée via `response_json_schema` + `response_mime_type="application/json"`, plutôt que tool use
Gemini n'a pas d'équivalent direct au tool use forcé d'Anthropic (`tool_choice={"type": "tool", ...}`) pour ce cas d'usage simple. `GenerateContentConfig.response_json_schema` accepte un schéma JSON Schema standard (proche du `input_schema` déjà utilisé côté Anthropic : `type: object`, `properties`, `items`, `enum`, `required`), combiné à `response_mime_type: "application/json"` pour forcer une réponse JSON conforme au schéma. Le corps de la réponse (`response.text`) est parsé avec `json.loads`, puis chaque entrée est validée par appartenance à `VALID_SENTIMENTS` — exactement la même logique de validation défensive qu'avec Anthropic (une entrée avec une valeur hors des 3 classes est ignorée, pas fatale).

Alternative écartée : `response.parsed` (auto-parsing Pydantic du SDK). Rejetée car documentée comme silencieusement `None` en cas d'échec de validation Pydantic (pas d'exception), ce qui masquerait une réponse malformée au lieu de la faire remonter comme erreur de lot (comportement actuel : une exception pendant `classify_batch` fait retomber tout le lot en `sentiment_status = 'error'`, cohérent avec le Requirement "Échec de classification d'un message").

### Modèle par défaut : `gemini-flash-lite-latest`
Équivalent économique/rapide à `claude-haiku-4-5` (précédent défaut), pour rester dans l'esprit "palier gratuit" recherché par l'utilisateur. `gemini-2.5-flash-lite` (version épinglée) a été essayé en premier mais rejeté par l'API en conditions réelles (`404 NOT_FOUND` : "no longer available to new users") avec la vraie clé de l'utilisateur, alors que ce modèle apparaît pourtant dans `client.models.list()` — bascule confirmée vers l'alias `gemini-flash-lite-latest`, qui a fonctionné en test réel (5 messages classés, résultats cohérents incluant les 3 classes). Configurable via `GEMINI_SENTIMENT_MODEL`, même mécanisme que `ANTHROPIC_SENTIMENT_MODEL` (à bumper si le taux d'accord de l'échantillon de validation reste sous 80%).

### `anthropic` reste une dépendance du projet
`app/themes.py` en dépend encore. `google-genai` est ajouté à côté, pas à la place, dans `pyproject.toml`.

### Correctif collatéral : valeurs de sentiment anglaises → françaises dans `net-sentiment-score.ts`
En vérifiant ce changement, le mode `"ai"` (dormant) de `insight-hub-web/src/db/net-sentiment-score.ts` (ajouté dans le changement `sentiment-and-distribution-dashboard`) s'est révélé filtrer sur `'positive'/'negative'/'neutral'` alors que `sentiment.py` — Anthropic comme désormais Gemini — écrit `'positif'/'négatif'/'neutre'`. Corrigé au passage pour que la bascule future de `NET_SENTIMENT_SOURCE` vers `"ai"` fonctionne réellement une fois la classification (Gemini) activée.

### Déclenchement automatique dans la même requête HTTP, pas de queue séparée
L'utilisateur ne veut plus appeler manuellement `/api/sentiment/runs` après chaque import. `run_import_pipeline` (dans `app/workflows.py`) appelle désormais `run_sentiment_classification()` directement après `finalize_success_step`, uniquement si `result["inserted_count"] > 0`. C'est cohérent avec le choix déjà fait dans ce projet de ne pas avoir d'orchestration durable (Vercel Workflows abandonné, voir `ARCHITECTURE.md`) : import et classification restent chacun "plain sequential", simplement chaînés l'un après l'autre dans la même requête `/api/import`. `run_sentiment_classification()` ne lève jamais d'exception (elle capture ses propres erreurs et les enregistre sur le run de sentiment) — un échec de classification ne peut donc jamais faire passer un import réussi en erreur.

Pour garder `run_import_pipeline` et `run_sentiment_classification` testables sans dépendre d'un vrai appel Gemini, les deux acceptent désormais un paramètre `client`/`sentiment_client` injectable (mêmes défauts `None` → vrai `genai.Client()` en production), sur le modèle déjà utilisé par `run_classification`.

Alternative écartée : une file d'attente/job séparé pour découpler classification et requête d'import. Rejetée comme prématurée — aucune infrastructure de queue n'existe dans ce projet (décision déjà actée pour éviter la complexité d'orchestration), et le volume de messages par import reste largement dans le budget de temps interne de `run_classification` (45s).

### Bug opérationnel trouvé en testant en conditions réelles : `uvicorn --reload` ne relit jamais `.env.local`
En testant le déclenchement automatique en conditions réelles (import via l'UI, serveur pipeline déjà démarré), la classification échouait instantanément (`processed_count = 0`) car `genai.Client()` levait une exception : `GEMINI_API_KEY` était absente de l'environnement du processus. Le serveur `uvicorn --reload` tournait depuis avant l'ajout de la clé à `.env.local`, et l'application ne relit jamais ce fichier elle-même (pas de `python-dotenv` dans le code applicatif, par choix — les variables sont censées être injectées par l'environnement d'exécution). `uvicorn[standard]` embarque `python-dotenv` en dépendance transitive et expose `--env-file` nativement ; redémarrer avec `uvicorn api.index:app --reload --env-file .env.local` a résolu le problème sans changement de code. À documenter pour l'équipe : après toute modification de `.env.local`, le serveur pipeline doit être redémarré (le rechargement à chaud de `--reload` ne recharge que le code Python, jamais les variables d'environnement).

## Risks / Trade-offs

- [Le quota gratuit Gemini (annoncé par l'utilisateur, non vérifié ici) pourrait ne pas couvrir un volume de messages plus important à l'avenir] → Hors contrôle de ce changement ; `GEMINI_SENTIMENT_MODEL` reste configurable si un modèle différent devient nécessaire, et la bascule vers un autre fournisseur suit le même pattern (un seul module à adapter).
- [Le schéma JSON accepté par Gemini est un sous-ensemble du JSON Schema complet (pas de support confirmé pour `additionalProperties`)] → `CLASSIFY_SCHEMA` a été volontairement simplifié (sans `additionalProperties`) par rapport à l'ancien `CLASSIFY_TOOL` Anthropic, sans perte fonctionnelle (l'`enum` sur `sentiment` et `required` suffisent à contraindre la sortie).
- [Chaîner classification et import dans la même requête HTTP allonge la durée totale de `/api/import`, ce qui pourrait approcher une limite de durée de fonction serverless une fois déployé sur Vercel (le budget interne de `run_classification` est de 45s)] → Acceptable en développement local (pas de limite de durée) ; à surveiller lors du déploiement Vercel réel — `run_classification` reste resumable (reprend les messages encore `pending` à l'invocation suivante), donc un dépassement de durée ne perd aucune donnée, il retarde seulement l'achèvement complet.

## Migration Plan

Pas de migration de données. Déploiement : ajouter `GEMINI_API_KEY` (et optionnellement `GEMINI_SENTIMENT_MODEL`) aux variables d'environnement du service pipeline avant le prochain déclenchement de classification. `ANTHROPIC_API_KEY` reste nécessaire pour `app/themes.py`. Rollback : revenir à l'implémentation Anthropic de `sentiment.py` (git revert), aucune donnée à corriger puisque le format stocké (`positif`/`négatif`/`neutre`) est identique quel que soit le fournisseur.
