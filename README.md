# Insight Hub

Outil de social listening : centraliser des messages en ligne sur une marque (mot-clé simulé,
comparaison possible à deux mots-clés), analyser leur sentiment (3 classes) et leurs thèmes (5-8)
via l'IA, et produire un dashboard + rapport de synthèse exploitable pour un responsable
marketing/communication. Écoute réactive (données déjà collectées), granularité journalière, pas
d'alerting automatique — voir [`PRD.md`](./PRD.md) pour le détail des arbitrages produit.

## Architecture

Deux services Vercel indépendants, partageant une base Neon (Postgres) commune :

- **`insight-hub-web`** — Next.js (App Router, TypeScript). Dashboard, déclenchement des imports,
  export PDF. Accès direct à Neon via Drizzle (schéma possédé exclusivement ici).
- **`insight-hub-pipeline`** — service Python (≥ 3.12, `uv`). Import CSV, normalisation,
  déduplication, filtrage par mot-clé, appels IA (SDK Gemini). Exécute le pipeline de manière
  synchrone dans la requête HTTP (pas d'orchestrateur externe). Accès à Neon en SQL simple
  (`psycopg`), jamais de modification de schéma.
- **Neon** — base Postgres partagée ; les migrations sont générées et appliquées uniquement depuis
  `insight-hub-web`.

Les deux services communiquent en HTTP, authentifiés par un bearer token secret partagé.

Détails complets : [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Lancer le projet en local

**Prérequis** : Node.js 20+, Python 3.12+, [`uv`](https://docs.astral.sh/uv/), une base Neon
Postgres.

1. **Variables d'environnement** — copier `.env.example` en `.env.local` à la racine et renseigner
   les vraies valeurs (`DATABASE_URL` Neon, `GEMINI_API_KEY` — sans elle, la classification
   sentiment/thèmes déclenchée après import échoue silencieusement en base, sans erreur visible
   dans le dashboard —, `PIPELINE_AUTH_TOKEN` — un secret partagé au choix —,
   `PIPELINE_SERVICE_URL=http://127.0.0.1:8000`). Copier ce fichier dans `insight-hub-web/.env.local`
   (Next.js ne lit que son propre dossier).

2. **Installer les dépendances**

   ```bash
   cd insight-hub-web && npm install
   cd ../insight-hub-pipeline && uv sync
   ```

3. **Appliquer les migrations Drizzle** (créent les tables `import_runs`/`messages` sur Neon)

   ```bash
   cd insight-hub-web && npm run db:migrate
   ```

4. **Lancer les deux serveurs** (dans deux terminaux)

   ```bash
   # Pipeline Python
   cd insight-hub-pipeline && uv run --env-file ../.env.local uvicorn api.index:app --host 127.0.0.1 --port 8000

   # Frontend Next.js
   cd insight-hub-web && npm run dev
   ```

   Puis ouvrir [http://localhost:3000/import](http://localhost:3000/import).

## Lancer les tests

```bash
cd insight-hub-pipeline
uv run pytest -m "not integration"   # unitaires, rapides
uv run pytest -m integration         # intégration (nécessite Docker — conteneur Postgres éphémère)
```

## Pour aller plus loin

- [`PRD.md`](./PRD.md) — cahier des charges produit.
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — choix techniques détaillés.
