## Context

`insight-hub-web` n'existe aujourd'hui que sous la forme de sa configuration Drizzle et du schéma de base (`import_runs`, `messages`) — aucune application Next.js n'a encore été scaffoldée. `insight-hub-pipeline` expose déjà `POST /api/import` (bearer token, mot-clé obligatoire, upload direct ou `blob_url`, création d'un run et statut consultable en base), issu du change `add-csv-ingestion-pipeline`.

`ARCHITECTURE.md` décrit un upload envoyé **directement** du navigateur vers `insight-hub-pipeline`, pour éviter un double saut réseau. Mais la politique projet impose de **ne jamais exposer de clé API au client** — or l'appel direct au pipeline nécessite le bearer token `PIPELINE_AUTH_TOKEN`. Ce design tranche cette tension : le secret ne quitte jamais le serveur `insight-hub-web`, quitte à réintroduire un saut réseau supplémentaire pour les petits fichiers (voir Décisions).

## Goals / Non-Goals

**Goals:**
- Un écran unique permettant de saisir un mot-clé et un fichier CSV, de déclencher un run d'import, et d'en suivre le statut jusqu'à son terme (terminé ou erreur).
- Aucun secret (`PIPELINE_AUTH_TOKEN`, `BLOB_READ_WRITE_TOKEN`) n'atteint le bundle client.
- Bascule transparente au-delà de 4.5 Mo, sans que l'utilisateur ait à s'en soucier.
- Scaffolding minimal de `insight-hub-web` (App Router, TypeScript) — juste ce qu'il faut pour porter cet écran, pas un dashboard complet.

**Non-Goals:**
- Aucun dashboard, aucune visualisation de messages/sentiment/thèmes — objet de changes ultérieurs qui dépendent des fondations IA (non construites ici).
- Aucune notification push ; le suivi du statut se fait par polling, cohérent avec l'architecture actée (« pas de push temps réel »).
- Aucune nouvelle bibliothèque de composants UI.
- Aucun changement de schéma de base de données.

## Decisions

**Soumission via une Server Action Next.js, pas un appel client direct au pipeline.**
Le navigateur poste le formulaire à une Server Action (`insight-hub-web`, code serveur uniquement). Cette action lit `PIPELINE_AUTH_TOKEN` côté serveur et relaie la requête vers `insight-hub-pipeline`. Alternative écartée : appel `fetch` direct du navigateur vers `insight-hub-pipeline` comme suggéré par une lecture littérale d'`ARCHITECTURE.md` — impossible sans exposer le bearer token au client, ce que la politique projet interdit explicitement. Le coût (un saut réseau de plus) ne s'applique qu'aux fichiers < 4.5 Mo, typiquement rapides.

**Upload direct vers Vercel Blob pour les fichiers > 4.5 Mo, via un token client à durée de vie courte.**
Pour les gros fichiers, le navigateur utilise le flux « client upload » de `@vercel/blob/client` : il demande d'abord un token à usage unique à une Route Handler serveur (`handleUpload`), puis envoie le fichier directement à Vercel Blob avec ce token — sans jamais recevoir `BLOB_READ_WRITE_TOKEN` lui-même. Une fois l'upload terminé, le navigateur transmet seulement l'URL Blob obtenue à la Server Action, qui relaie `{ blob_url, keyword, filename }` au pipeline. Alternative écartée : faire transiter le fichier par le serveur Next.js avant de l'envoyer à Blob — réintroduirait le double saut réseau qu'`ARCHITECTURE.md` cherche justement à éviter pour les gros fichiers, sans bénéfice de sécurité supplémentaire (le token client à usage unique n'est pas un secret réutilisable).

**Détection de la taille côté client (`File.size`) pour choisir le chemin d'upload.**
Le navigateur choisit lui-même, avant tout appel réseau, entre soumission directe (< 4.5 Mo) et upload Blob (≥ 4.5 Mo). Alternative écartée : laisser le serveur trancher après réception — obligerait à accepter d'abord le fichier complet côté serveur avant de savoir s'il fallait passer par Blob, ce qui est exactement le saut réseau à éviter.

**Lecture du statut du run directement via Drizzle, pas via une route du pipeline.**
`insight-hub-web` interroge Postgres directement (accès déjà prévu par l'architecture : schéma possédé par Drizzle côté web) pour lire `import_runs`. Alternative écartée : ajouter une route `GET /api/import/:id` côté pipeline — duplication inutile, alors que le statut est une simple lecture SQL déjà accessible depuis le service qui possède le schéma.

**Polling à intervalle fixe (2 s) tant que le statut n'est pas terminal.**
Simple et suffisant pour un import de taille MVP (secondes à dizaines de secondes). Alternative écartée : polling avec backoff exponentiel — complexité non justifiée à ce stade ; à revisiter si des imports significativement plus longs apparaissent.

**Aucune nouvelle bibliothèque de composants UI.**
Le projet `insight-hub-web` étant scaffoldé pour la première fois dans ce change, il n'existe aucun composant réutilisable. Formulaire et affichage de statut sont construits en React/HTML natif + CSS minimal, cohérent avec « interface claire et minimaliste » et la contrainte de ne pas ajouter de bibliothèque UI sans nécessité.

**Route dédiée `/import` plutôt que la racine `/`.**
La racine sera occupée par le dashboard « santé de la marque » dans un change ultérieur (dépendant des analyses IA, non construites ici) ; réserver `/import` évite d'avoir à déplacer cet écran plus tard.

## Risks / Trade-offs

- **[Risque]** Le saut réseau supplémentaire (navigateur → Server Action → pipeline) pour les petits fichiers diverge de la lecture littérale d'`ARCHITECTURE.md` → **Mitigation** : documenté ici comme déviation intentionnelle, limitée aux fichiers < 4.5 Mo ; l'alternative aurait nécessité d'exposer un secret au client.
- **[Risque]** Le polling à intervalle fixe peut générer un trafic inutile si un run reste bloqué longtemps en erreur non catchée → **Mitigation** : le polling s'arrête dès que le statut est `completed` ou `error` (statuts terminaux garantis par le pipeline).
- **[Trade-off]** Absence de bibliothèque de composants UI signifie un formulaire et un affichage de statut « faits main » — acceptable pour un MVP à un seul écran, à revisiter si un vrai design system est introduit plus tard.
- **[Risque]** Lecture directe de Postgres par `insight-hub-web` pendant que `insight-hub-pipeline` y écrit concurremment → **Mitigation** : lectures simples (`SELECT` sur `import_runs`), aucune contention d'écriture introduite.

## Migration Plan

1. Scaffolder l'application Next.js (App Router, TypeScript) dans `insight-hub-web`, en conservant la configuration Drizzle existante.
2. Implémenter la route `/import` : formulaire (mot-clé + fichier), Server Action de soumission, Route Handler `handleUpload` pour le flux Blob.
3. Implémenter l'affichage du statut du run avec polling.
4. Tester avec Playwright (responsive, fonctionnel) — contrainte de fin de développement UI du projet.
5. Rollback : aucune opération destructive — cet écran ne fait qu'appeler un endpoint déjà existant et lire des tables déjà existantes ; un retrait de l'écran n'affecte ni le schéma ni les données.

## Open Questions

- Le nom exact de la Server Action et de la Route Handler `handleUpload` sera arrêté à l'implémentation, sans impact sur le contrat fonctionnel décrit ici.
