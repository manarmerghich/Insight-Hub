## Why

Le dashboard affiche déjà tous les KPIs bruts (score de sentiment net, thèmes à risque, tendances, pics, répartitions) mais laisse au responsable marketing/communication le travail de les interpréter lui-même pour répondre aux 3 questions business du PRD (notre image se dégrade-t-elle ? quel thème génère le plus de négatif ? sur quelle plateforme/pays sommes-nous le plus exposés ?). Le PRD (section 2.D, "Synthèse finale") prévoit justement un résumé exécutif généré par IA — une synthèse en langage naturel construite à partir des KPIs déjà calculés, pas une nouvelle analyse IA sur les messages bruts — comme dernière étape de la chaîne de dépendances (sentiment → thèmes → synthèse).

## What Changes

- Ajout d'une carte "Résumé exécutif" sur le dashboard, affichant une synthèse en langage naturel générée par IA à partir des KPIs déjà calculés côté serveur (score de sentiment net + comparaison temporelle, thème le plus à risque + tendance, répartition plateforme/pays, exemple de message représentatif) — jamais un nouvel appel IA sur les messages bruts.
- Nouveau endpoint pipeline `POST /api/summary` (FastAPI, même auth bearer que les endpoints existants) qui reçoit les KPIs déjà agrégés par le web, appelle Gemini une fois (`google-genai`, même pattern que `sentiment.py`/`themes.py`) pour produire le texte de synthèse, et persiste le résultat.
- Mise en cache du résumé par périmètre de consultation (import + filtres actifs) : un seul appel Gemini est déclenché par périmètre non encore couvert ; toute consultation identique ultérieure (mêmes filtres, mêmes données) réutilise le résultat déjà stocké sans rappeler Gemini.
- Dégradation gracieuse : un échec ou une lenteur de génération n'empêche jamais l'affichage du reste du dashboard (mêmes garanties que le pipeline existant : jamais d'exception qui remonte, statut d'erreur capturé).

## Capabilities

### New Capabilities
- `ai-executive-summary` : génération, mise en cache et restitution sur le dashboard d'un résumé exécutif en langage naturel produit par IA à partir des KPIs déjà calculés (sentiment net, thèmes à risque, répartitions, exemples représentatifs), avec la règle d'insight actionnable du PRD (toujours un chiffre + une comparaison + un exemple concret).

### Modified Capabilities
(aucune — les KPIs existants et leurs contrats ne changent pas ; cette capacité les consomme en lecture seule)

## Impact

- **insight-hub-pipeline** : nouveau module `app/summary.py` (appel Gemini + construction du prompt), nouvelle route `POST /api/summary` dans `api/index.py`, nouvelle variable d'environnement `GEMINI_SUMMARY_MODEL` (optionnelle, même défaut `gemini-flash-lite-latest`).
- **insight-hub-web** : nouvelle table Drizzle `executive_summaries` (cache), nouveau module `src/db/executive-summary.ts` (lecture du cache + appel au pipeline si absent), nouveau composant `src/app/dashboard/executive-summary-card.tsx`, intégration dans `src/app/dashboard/page.tsx`.
- Aucune migration de données existantes, aucun changement de contrat sur les KPIs déjà exposés.
