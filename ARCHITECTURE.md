# Insight Hub — Architecture technique

Ce document décrit l'architecture retenue pour Insight Hub (cf. `PRD.md`). Il ne liste que les choix actés — pas les options écartées en cours de route.

---

## 1. Vue d'ensemble

Deux projets Vercel séparés, communiquant en HTTP, partageant une base Postgres commune :

```
┌─────────────────────────┐         HTTP (bearer token)        ┌──────────────────────────────┐
│   insight-hub-web        │ ──────────────────────────────────▶│   insight-hub-pipeline         │
│   Next.js (TypeScript)   │◀──────────────────────────────────│   Python (fonctions Vercel)    │
│   Dashboard + export PDF │         statut / résultats         │   Import, IA, orchestration    │
└─────────────┬────────────┘                                     └───────────────┬───────────────┘
              │                                                                   │
              │                        lecture/écriture SQL                       │
              ▼                                                                   ▼
                          ┌────────────────────────────────────────┐
                          │        Neon (Postgres serverless)        │
                          │  schéma possédé par Drizzle (projet web) │
                          └────────────────────────────────────────┘
```

- **`insight-hub-web`** : frontend/dashboard, Next.js App Router, TypeScript. Seul point d'entrée pour l'utilisateur.
- **`insight-hub-pipeline`** : service Python (fonctions serverless Vercel), porte l'import CSV, la normalisation/dédup, les appels IA (sentiment, thèmes, résumé) et leur orchestration durable.
- **Neon Postgres** : base unique partagée par les deux projets.

---

## 2. Frontend — `insight-hub-web`

- **Framework** : Next.js (App Router, TypeScript), déployé sur Vercel.
- **Rôle** : dashboard (vue santé de la marque, filtres croisés, comparaisons temporelle/géographique/mots-clés, recherche plein texte, favoris, nuage de mots, timeline avec pics a posteriori), déclenchement d'un import, export PDF.
- **Accès aux données** : lecture/écriture directe sur Neon via `@neondatabase/serverless` + **Drizzle** (le schéma et les migrations sont possédés par ce projet — voir section 4).
- **Visualisations spécifiques** :
  - Carte / classement pays : `react-simple-maps`
  - Nuage de mots par sentiment : `@visx/wordcloud`
- **Export PDF** : `@react-pdf/renderer` (PDF basique en MVP, enrichi avec résumé IA + favoris en V2). Pas de navigateur headless nécessaire.
- **Favoris** : Server Action + `useOptimistic`, persistés dans Postgres.
- **Recherche plein texte** : native Postgres (`tsvector` / index GIN).
- **Upload CSV** : le fichier est envoyé directement au service `insight-hub-pipeline` (voir section 3) plutôt que de transiter par une route API Next.js, pour éviter un double saut réseau. Si le fichier dépasse 4.5 Mo (limite de payload par défaut d'une fonction Vercel), l'upload passe par **Vercel Blob** et le service Python lit le fichier depuis Blob.

---

## 3. Pipeline data & IA — `insight-hub-pipeline`

- **Langage** : Python (≥ 3.12), déployé comme fonctions serverless Vercel, projet Vercel indépendant.
- **Gestionnaire de paquets** : `uv`.
- **Périmètre** :
  - Import CSV, normalisation (espaces parasites, formats de date), déduplication, filtrage par mot-clé.
  - Analyse IA via le **SDK Anthropic Python** : sentiment 3 classes, détection de thèmes (5-8 max), résumé exécutif.
  - Traçabilité de chaque message (source, date de collecte) écrite en base.
- **Accès aux données** : driver SQL simple côté Python (`psycopg` / SQLAlchemy Core) — **pas d'ORM Python possédant son propre schéma**, pour éviter toute divergence avec le schéma Drizzle. Les migrations restent générées et appliquées uniquement depuis `insight-hub-web`.
- **Sécurité** : le service n'est pas public. Les appels entrants depuis `insight-hub-web` sont authentifiés par un jeton secret partagé (bearer token) transmis en en-tête, stocké comme variable d'environnement sur les deux projets Vercel.

---

## 4. Orchestration du pipeline — Vercel Workflows (Python)

- **Choix retenu** : **Vercel Workflows**, SDK Python (`vercel` sur PyPI), plutôt qu'un service tiers (Inngest) — solution native Vercel, aucun compte/service externe, aucune clé de signature à gérer.
- **Fonctionnement** :
  - `@wf.workflow` définit la fonction durable (le pipeline complet).
  - `@wf.step` définit chaque étape retryable (import/normalisation → sentiment → thèmes → résumé), chacune compilée en route isolée. Le workflow se suspend sans consommer de ressources pendant l'exécution d'un step, puis reprend automatiquement.
  - Cela respecte l'ordre de dépendances du PRD (fondations → sentiment IA → thèmes IA → synthèse finale) et contourne la limite de durée d'exécution d'une fonction serverless classique.
- **Déclenchement** : `insight-hub-web` démarre un run via un appel HTTP au service Python après upload du CSV ; le statut d'avancement et les résultats sont lus depuis Postgres (pas de push temps réel — cohérent avec un dashboard consulté à la demande, sans notification automatique).
- **Point de vigilance connu** : le support Python de Vercel Workflows est en **beta** (API et comportement susceptibles de changer). Solution de repli identifiée si cela bloque en cours de dev : Inngest Python (SDK stable), au prix d'une intégration Vercel à câbler manuellement (non documentée officiellement pour Python).

---

## 5. Base de données — Neon Postgres

- **Service** : Neon (Postgres serverless).
- **Schéma** : possédé exclusivement par `insight-hub-web` (Drizzle + `drizzle-kit` pour les migrations). Le service Python ne fait que lire/écrire via SQL, jamais de modification de schéma.
- **Contenu** : messages (avec traçabilité source/date de collecte), sentiment (recalculé + émotion d'origine en donnée secondaire), étiquette de thème par message, métadonnées d'engagement (likes/retweets), statut des runs de pipeline, favoris.
- **Recherche** : index `tsvector`/GIN pour la recherche plein texte côté dashboard.

---

## 6. Déploiement

- Deux projets Vercel distincts (`insight-hub-web`, `insight-hub-pipeline`), déployés indépendamment.
- Variables d'environnement partagées entre les deux projets : chaîne de connexion Neon, clé API Anthropic, jeton secret d'authentification inter-services.
- Chaque projet a son propre cycle de déploiement/rollback — pas de couplage de build entre le frontend et le pipeline.

