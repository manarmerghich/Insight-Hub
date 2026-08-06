## Context

Le dashboard (`insight-hub-web/src/app/dashboard/page.tsx`) calcule déjà tous les KPIs nécessaires en Server Component, à la demande (`export const dynamic = "force-dynamic"`), via des modules `src/db/*.ts` qui interrogent Neon directement avec Drizzle : score de sentiment net + tendance (`net-sentiment-score.ts`), score de risque réputationnel par thème + tendance (`theme-risk-score.ts`), classement des thèmes (`theme-ranking.ts`), répartition plateforme/pays (`message-distribution.ts`), pics de sentiment (`sentiment-timeline-peaks.ts`), messages représentatifs (`representative-messages.ts`), taux d'engagement par sentiment (`engagement-rate.ts`).

Les appels IA (Gemini, `google-genai`) vivent exclusivement côté `insight-hub-pipeline` (voir `sentiment.py` et `themes.py`, tous deux basculés sur Gemini par les changements `switch-sentiment-classification-to-gemini` et `switch-theme-classification-to-gemini`) : même schéma `client.models.generate_content(model=..., config={"response_mime_type": "application/json", "response_json_schema": ...})`, modèle par défaut `gemini-flash-lite-latest` configurable par variable d'environnement, jamais d'exception qui remonte (erreurs capturées et enregistrées sur un run). `insight-hub-web` appelle `insight-hub-pipeline` en HTTP bearer token (`PIPELINE_SERVICE_URL` + `PIPELINE_AUTH_TOKEN`, voir `import/actions.ts`), et le pipeline écrit déjà dans des tables possédées par le schéma Drizzle du web (`messages`, `themes`, `sentiment_runs`, `theme_runs`) via `psycopg`, sans jamais modifier ce schéma.

Le PRD (section 2.D) positionne le résumé exécutif comme dernière étape de la chaîne de dépendances (sentiment → thèmes → synthèse), une synthèse en langage naturel construite à partir des KPIs déjà calculés — pas une nouvelle analyse de messages bruts — et impose la règle d'insight actionnable (section 1.6) : toujours un chiffre + une comparaison + un exemple concret cité, jamais un chiffre seul.

## Goals / Non-Goals

**Goals:**
- Générer une synthèse en langage naturel à partir des KPIs déjà calculés côté serveur (le résumé ne relit jamais les messages bruts et ne relance jamais de classification).
- Garantir au plus un appel Gemini par périmètre de consultation non encore couvert (import + filtres actifs), toute consultation identique ultérieure réutilisant un résultat déjà stocké.
- Ne jamais casser ou ralentir le reste du dashboard si la génération échoue ou est lente (dégradation gracieuse, même garantie que les autres appels IA du pipeline).
- Respecter la règle d'insight actionnable du PRD dans le contenu du texte généré.

**Non-Goals:**
- Ne remplace aucun KPI existant ni son contrat (`ai-executive-summary` est un consommateur en lecture seule des KPIs déjà exposés, aucune capacité existante n'est modifiée).
- Pas de rafraîchissement en arrière-plan ni de pré-génération proactive (le résumé se génère à la demande, à la première consultation d'un périmètre donné) — cohérent avec le choix déjà acté du projet de ne pas avoir d'orchestration durable (Vercel Workflows abandonné, voir `ARCHITECTURE.md`).
- Pas de streaming du texte généré : la réponse est retournée complète en une fois.
- Pas de comparaison à deux mots-clés dans le résumé (hors périmètre MVP/V1 du PRD pour cette capacité).

## Decisions

### Nouvel endpoint pipeline `POST /api/summary`, pas d'appel Gemini direct depuis le web
Cohérent avec la répartition déjà actée dans `ARCHITECTURE.md` ("insight-hub-pipeline... les appels IA... pour sentiment/thèmes/résumé exécutif") et avec le seul SDK IA du projet (`google-genai`) qui vit dans `insight-hub-pipeline` (aucune dépendance IA côté `insight-hub-web`, aucune clé Gemini dans ses variables d'environnement). Le web calcule/rassemble les KPIs déjà disponibles et les envoie en JSON au pipeline ; le pipeline construit le prompt et appelle Gemini. Alternative écartée : appeler Gemini directement depuis une Server Action du web (le SDK ne fuiterait pas la clé au client, mais dupliquerait la dépendance `google-genai` dans les deux projets et casserait la séparation des responsabilités déjà documentée).

### Table de cache `executive_summaries`, possédée par le schéma Drizzle du web
Nouvelle table (migration `drizzle-kit`) :
```
executive_summaries
- id: serial primary key
- run_id: integer references import_runs(id)
- scope_key: text (empreinte du périmètre, voir plus bas)
- summary_text: text
- model: text (nom du modèle Gemini utilisé)
- created_at: timestamp
- unique(run_id, scope_key)
```
Le pipeline y écrit directement via `psycopg` (même pattern que `sentiment.py`/`themes.py` écrivant dans `messages`, table elle aussi possédée par le schéma web) après avoir obtenu la réponse Gemini, puis retourne `summary_text` dans la réponse HTTP au web — pas de round-trip de lecture supplémentaire nécessaire pour afficher le résultat immédiatement. Alternative écartée : laisser le web insérer la ligne de cache après réception de la réponse pipeline. Rejetée pour rester cohérent avec le pattern déjà établi où le pipeline est la seule couche qui écrit le résultat de ses propres appels IA (`sentiment_runs`, `theme_runs`), le web restant lecteur de ces résultats.

### `scope_key` = empreinte des filtres actifs + volume de messages classés dans le scope, pas un hash de l'intégralité des KPIs
`scope_key` est dérivé de façon déterministe côté web à partir de : les filtres actifs sérialisés (période, plateforme, pays, sentiment, thème — mêmes champs que `DashboardFilters`, recherche plein texte et favoris exclus car ils ne modifient pas les KPIs agrégés, voir `dashboard-filters.ts`) et le nombre total de messages classés (sentiment + thème) dans ce scope. Ce dernier élément fait que le cache s'invalide naturellement dès qu'un nouveau lot de messages termine sa classification (le PRD garantit une donnée toujours fraîche par KPI, voir Requirement "Fresh Data On Every Visit" dans plusieurs specs existantes ; ce chiffre de volume classé sert de proxy peu coûteux à "les données du scope ont changé" sans avoir à hasher l'ensemble des KPIs). Alternative écartée : hash de tous les KPIs affichés. Rejetée car plus coûteuse à calculer et à invalider correctement (tout changement mineur d'arrondi régénérerait inutilement), pour un bénéfice marginal par rapport au proxy volume classé.

### Réponse Gemini structurée en un seul champ texte (`response_json_schema` avec `{"summary": string}`), pas de champs par insight
Même mécanisme de sortie structurée que `sentiment.py`/`themes.py` (`response_mime_type: application/json` + `response_json_schema`), pour la fiabilité de parsing déjà validée en conditions réelles sur ce projet — mais avec un schéma minimal à un seul champ `summary` (chaîne, non vide) plutôt qu'un champ par insight. La règle d'insight actionnable (chiffre + comparaison + exemple) est imposée par la formulation du prompt (les chiffres et exemples fournis dans le payload d'entrée doivent apparaître dans le texte), pas par la structure de sortie — cohérent avec le PRD qui demande une "synthèse en langage naturel", pas une liste structurée d'insights. Alternative écartée : un schéma avec un insight par question business (dégradation image / thème le plus négatif / plateforme-pays le plus exposé). Rejetée comme sur-ingénierie pour ce changement : le texte libre couvre déjà ces 3 questions via le prompt, et une structure plus riche pourrait être ajoutée plus tard sans changer le contrat de cache actuel.

### Dégradation gracieuse synchrone, pas de tâche de fond
Contrairement à la classification sentiment/thème (déclenchée en fire-and-forget après import), la génération du résumé se déclenche à la demande pendant le rendu de la page dashboard et doit rester dans le budget de temps d'une requête HTTP normale. Le web appelle le pipeline avec un timeout court (quelques secondes) ; en cas d'échec, timeout, ou réponse invalide, la carte affiche un état "Résumé indisponible pour le moment" au lieu de faire échouer la page — le `Promise.all` existant de `page.tsx` n'inclut pas cet appel (il reste après, pour ne pas ralentir les KPIs déjà rapides à calculer). Le pipeline, de son côté, ne lève jamais d'exception non gérée (capture ses propres erreurs Gemini/DB et retourne un statut d'erreur explicite), même garantie que `run_classification`/`run_theme_classification`.

## Risks / Trade-offs

- [Le proxy "volume de messages classés" pour invalider le cache peut manquer un cas où les données changent sans changer de volume (ex. re-classification qui change un sentiment déjà `completed` vers une autre classe)] → Accepté : ce cas ne se produit pas dans ce projet (le sentiment/thème d'un message `completed` n'est jamais recalculé, voir `sentiment.py`/`themes.py` qui ne traitent que `pending`/`error`), donc le volume classé est un proxy fiable en pratique.
- [Le budget de temps d'une requête HTTP synchrone pour l'appel Gemini pourrait approcher une limite de durée de fonction serverless une fois déployé sur Vercel] → Mitigation : timeout court côté web avec dégradation gracieuse (état "indisponible" plutôt qu'erreur de page), cohérent avec le risque déjà documenté et accepté pour sentiment/thème dans les changements précédents.
- [Le quota gratuit Gemini partagé (sentiment + thème + résumé) réduit encore la marge disponible] → Hors contrôle de ce changement ; `GEMINI_SUMMARY_MODEL` reste configurable indépendamment, et la mise en cache par `scope_key` limite structurellement le nombre d'appels au strict nécessaire (un par périmètre de consultation réellement nouveau).

## Migration Plan

Migration Drizzle additive : nouvelle table `executive_summaries` (`drizzle-kit generate` + `migrate`), aucune donnée existante affectée. Déploiement pipeline : `GEMINI_API_KEY` déjà en place (réutilisée) ; `GEMINI_SUMMARY_MODEL` optionnelle. Rollback : retirer la carte du dashboard et la route `/api/summary` (git revert), la table de cache peut rester en base sans effet si la fonctionnalité est désactivée.
