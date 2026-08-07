## Context

`insight-hub-web` et `insight-hub-pipeline` partagent une base Neon unique. Aujourd'hui, "les données" désignent implicitement *tout* ce qui a été importé, tous visiteurs confondus : `getLatestImportRun()` prend le run le plus récent de la table `import_runs` sans aucune restriction, et toutes les fonctions de KPI (`net-sentiment-score`, `keyword-comparison`, export PDF, résumé exécutif, recherche, favoris…) partent de ce `runId` unique. La base a été purgée manuellement une fois, mais rien n'empêche structurellement un nouveau visiteur de repolluer la vue de tous les autres au prochain import. Le PRD exclut explicitement un vrai système de comptes (outil à usage individuel) ; on introduit donc une identité de session anonyme, pas une authentification.

## Goals / Non-Goals

**Goals:**
- Un visiteur qui n'a jamais importé de données voit un dashboard entièrement vide, quel que soit ce que d'autres visiteurs ont importé.
- Aucune fuite croisée : ni les messages, ni les mots-clés (y compris via le sélecteur de comparaison), ni les résumés IA d'un visiteur ne sont visibles par un autre.
- Aucune saisie d'identifiant (email, mot de passe) ; l'attribution est automatique et transparente dès la première requête.
- Changement additif côté schéma et minimalement invasif côté code : une seule dimension de filtre (`visitor_id`) ajoutée aux résolveurs existants, pas de refonte des calculs de KPI eux-mêmes.

**Non-Goals:**
- Comptes utilisateurs, connexion, récupération d'accès après perte des cookies, synchronisation multi-appareil.
- Contrôle d'accès fin entre visiteurs (partage, rôles, vue admin) — chaque visiteur est une bulle isolée, point.
- Protection anti-abus / rate limiting par visiteur.
- Politique de rétention des sessions abandonnées (nettoyage périodique) — signalé en risque, non traité ici.

## Decisions

### Identifiant : UUID v4 aléatoire non signé, pas de JWT
`crypto.randomUUID()` (natif Node, aucune dépendance nouvelle), 122 bits d'aléa. La garantie d'isolation ne repose pas sur l'infalsifiabilité du cookie (ce n'est pas un jeton d'autorisation à privilèges) mais sur le fait qu'un visiteur ne peut pas *deviner* l'identifiant d'un autre. Signer le cookie (HMAC/JWT) n'améliorerait pas cette propriété et ajouterait une dépendance et un secret à gérer pour rien. Alternative écartée : jeton signé — rejetée comme complexité non justifiée par le modèle de menace ("pas de compte, juste une bulle de données").

### Attribution : middleware Next.js, pas une attribution paresseuse par action
`insight-hub-web/src/middleware.ts`, matché sur toutes les routes, génère et pose le cookie dès qu'il est absent — **avant** le rendu de la première page. Point d'attention technique : pour que le Server Component de cette même première requête voie déjà le cookie (et n'affiche pas un état vide "flash" avant reload), il faut le poser à la fois sur la requête sortante transmise au rendu (`NextResponse.next({ request: { headers } })` après avoir muté `request.cookies`) et sur la réponse renvoyée au navigateur. Alternative écartée : attribution paresseuse au premier import (dans le Server Action) — rejetée parce qu'un visiteur qui ne fait que consulter `/dashboard` sans jamais importer n'obtiendrait jamais d'identifiant, et une Server Component ne peut de toute façon pas poser de cookie elle-même.

### Stockage : nouvelle colonne sur `import_runs`, **et** sur `messages`
`import_runs.visitor_id text not null` + index btree (chaque résolveur filtre dessus).

**Correction post-implémentation** (bug trouvé en vérification manuelle, avant archivage de ce change) : l'affirmation initiale — "`messages` n'a besoin d'aucune colonne supplémentaire, déjà scopée transitivement via `run_id`" — était fausse pour la contrainte de déduplication (`messages_dedup_key` sur `platform, user, text, timestamp`, voir `csv-ingestion`). Cette contrainte ne référence jamais `run_id` : deux visiteurs différents important le même fichier produisent des lignes de contenu identique, donc le second se heurte à `ON CONFLICT DO NOTHING` et se retrouve avec `retained_count = 0`, silencieusement, sans erreur. `messages` a donc aussi besoin de `visitor_id text not null` (dénormalisé depuis le run à l'insertion — indispensable ici car une contrainte `UNIQUE` ne peut pas référencer une colonne d'une autre table), et la contrainte devient `unique(visitor_id, platform, "user", text, timestamp)`. La déduplication au sein des données d'un même visiteur reste inchangée (toujours déduplicée) ; seule la déduplication *entre* visiteurs disparaît, ce qui est le comportement correct.

### Propagation au pipeline : nouveau champ de formulaire requis, pas un changement d'auth
`POST /api/import` (`insight-hub-pipeline`) accepte un champ `visitor_id` requis au même titre que `keyword`, lu depuis le cookie côté Server Action et transmis dans le corps `multipart/form-data`. Le bearer token partagé entre les deux services ne change pas — `visitor_id` est une donnée applicative, pas un mécanisme d'auth.

### Scoping en lecture : paramètre obligatoire sur chaque résolveur de "scope courant", pas de Row-Level Security Postgres
`getLatestImportRun`, `getDashboardFilterOptions`, `getComparableKeywords`, `getLatestRunIdForKeyword` (et tout point d'entrée qui en dérive un `runId` : export PDF, résumé exécutif) reçoivent `visitorId` en paramètre **obligatoire** (pas optionnel), pour qu'un oubli soit une erreur de compilation TypeScript plutôt qu'une fuite silencieuse. Alternative écartée : policies RLS Postgres avec une variable de session (`SET app.visitor_id`) — plus robuste à long terme, mais mal adaptée au driver `neon-http` actuel (HTTP sans connexion persistante par requête) et disproportionnée pour un outil à session anonyme sans vrai enjeu d'autorisation. À reconsidérer si le projet évolue vers de vrais comptes.

### Lignes existantes sans `visitor_id` : sentinelle, pas suppression
Avant d'imposer `NOT NULL`, toute ligne existante sans `visitor_id` est rattachée à une valeur sentinelle fixe (`'legacy-shared'`) plutôt que supprimée — cette valeur ne peut jamais coïncider avec un UUID v4 généré, donc ces lignes deviennent invisibles de tout visiteur réel sans perte de données. (La base ayant été purgée manuellement juste avant ce changement, ce backfill est un no-op attendu en pratique, mais protège toute donnée de test réintroduite entre-temps.)

## Risks / Trade-offs

- [Quiconque obtient la valeur du cookie (poste partagé, extension malveillante, capture d'écran d'URL contenant le cookie) accède aux données de ce visiteur] → Accepté explicitement par l'utilisateur ("cookie, pas de compte/mot de passe") ; mitigé par `httpOnly` (inaccessible en JS client), `Secure`, `SameSite=Lax`.
- [Effacer les cookies ou changer de navigateur/appareil fait perdre l'accès à l'historique, sans recours] → Accepté, déjà documenté comme limite assumée dans la proposal.
- [Aucune purge des sessions abandonnées : la base grossit indéfiniment si l'app devient publique] → Hors périmètre ; à traiter séparément (rétention par âge) si le volume devient un problème réel.
- [Une fonction de lecture qui oublierait de propager `visitorId` réintroduirait une fuite silencieuse] → Mitigation : `visitorId` obligatoire (pas de valeur par défaut `undefined` silencieuse) sur chaque résolveur concerné, détectable à la compilation.

## Migration Plan

1. Migration Drizzle additive sur `import_runs` : `ADD COLUMN visitor_id text NOT NULL DEFAULT 'legacy-shared'` puis `DROP DEFAULT` (pour que tout futur insert soit obligé de fournir une vraie valeur), + index btree.
1bis. Migration Drizzle additive sur `messages` (correctif dédup) : `ADD COLUMN visitor_id text` (nullable dans un premier temps), backfill réel — pas une sentinelle, la vraie valeur est connue — via `UPDATE messages SET visitor_id = import_runs.visitor_id FROM import_runs WHERE messages.run_id = import_runs.id`, puis `ALTER COLUMN visitor_id SET NOT NULL`, puis remplacement de la contrainte `messages_dedup_key` par sa version incluant `visitor_id`.
2. Déploiement dans cet ordre : migration DB (`insight-hub-web`) → `insight-hub-pipeline` (champ `visitor_id` requis sur `/api/import`) → `insight-hub-web` (middleware + propagation). Cet ordre évite une fenêtre où le web enverrait déjà le champ à un pipeline qui ne l'attend pas encore (inoffensif) suivie de son inverse (pipeline exigeant le champ avant que le web ne le fournisse, ce qui casserait tout import).
3. Rollback : rendre `visitor_id` de nouveau optionnel côté pipeline, revenir à la résolution globale côté web (retirer le paramètre des résolveurs). La colonne peut rester en base sans effet si elle n'est plus lue.

## Open Questions

- Faut-il conserver un accès "admin" (toi) permettant de voir toutes les données tous visiteurs confondus, par exemple pour du support ? Non traité dans ce changement — à réévaluer si le besoin se présente concrètement.
- Durée de vie du cookie : proposé 1 an glissant (renouvelé à chaque visite dans le middleware) — à confirmer avant implémentation.
