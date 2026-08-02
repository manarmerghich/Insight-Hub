## Context

Ce change construit la toute première brique du service `insight-hub-pipeline` (aucun code existant à ce jour). Il n'y a pas encore de table `messages` en base Neon : ce change en introduit le schéma minimal, en coordination avec `insight-hub-web` qui possède les migrations Drizzle.

Le jeu de données de référence (`social-media-sentiments_analysis.csv`) contient des espaces parasites dans plusieurs colonnes texte (`Text`, `Sentiment`, `User`, `Platform`, `Country`), confirmés par un extrait du fichier. C'est la contrainte concrète qui pilote la normalisation.

L'architecture actée (`ARCHITECTURE.md`) impose : upload direct au service Python (bascule Vercel Blob au-delà de 4.5 Mo), orchestration par Vercel Workflows (steps retryables), et un statut de run lisible depuis Postgres (pas de push temps réel).

## Goals / Non-Goals

**Goals:**
- Importer un CSV (upload direct ou via Vercel Blob), le normaliser, le filtrer par mot-clé, le dédupliquer, puis l'écrire en base avec traçabilité (source, date de collecte).
- Rendre le mot-clé de filtrage paramétrable par run, pour ne pas bloquer la comparaison à deux mots-clés prévue en V2.
- Exposer un statut de run consultable, cohérent avec le mécanisme de polling décrit dans l'architecture.

**Non-Goals:**
- Aucun appel IA (sentiment, thèmes, résumé) — ce change couvre uniquement les fondations du PRD (section 3).
- Aucune ingestion de flux live — l'architecture reste compatible avec un ajout futur, mais rien n'est construit ici.
- Aucune UI d'upload côté `insight-hub-web` — seul le service `insight-hub-pipeline` est concerné.
- Aucune déduplication approximative (fuzzy matching) — la déduplication reste stricte, basée sur une égalité de champs normalisés.

## Decisions

**Table `messages` avec contrainte d'unicité pour la déduplication.**
La déduplication est appliquée via une contrainte `UNIQUE` en base (sur une clé composée de la plateforme, l'auteur, le texte normalisé et le timestamp) combinée à `ON CONFLICT DO NOTHING`, plutôt qu'un `SELECT` de vérification avant chaque `INSERT`. Alternative écartée : vérifier l'existence avant insertion — plus lent (un aller-retour par ligne) et sujet à des conditions de course si deux runs s'exécutent en parallèle sur le même mot-clé. La contrainte en base est atomique et gère nativement ce cas.

**Clé de déduplication : plateforme + auteur + texte normalisé + timestamp**, pas le texte seul ni la ligne CSV brute. Alternative écartée : dédupliquer sur toutes les colonnes (trop strict — un doublon avec un compteur de likes différent au moment du second scrape resterait perçu comme un doublon métier) ou sur le texte seul (trop permissif — deux auteurs différents peuvent légitimement poster un texte identique, ex. retweet/citation).

**Le mot-clé est un paramètre obligatoire du run, stocké avec chaque message retenu** (colonne `keyword` sur `messages`), plutôt que configuré une fois globalement. Cela permet à un run ultérieur d'importer le même CSV avec un mot-clé différent sans conflit, condition nécessaire à la comparaison à deux mots-clés du PRD (V2) sans réimport ni migration de données.

**Filtrage par mot-clé : recherche insensible à la casse, sous-chaîne simple** sur le texte normalisé — pas de recherche par limites de mots ni de NLP. Le PRD demande de « simuler » une marque suivie, pas une recherche experte ; une correspondance simple est suffisante et reste prévisible pour l'utilisateur qui choisit le mot-clé.

**Un `import_runs` minimal (id, mot-clé, nom du fichier source, statut, horodatages, message d'erreur) accompagne la table `messages`.** Nécessaire pour satisfaire l'exigence d'architecture d'un statut de run consultable depuis Postgres (pas de notification push), et pour donner un point d'ancrage (`run_id`) à la traçabilité par message. Alternative écartée : dériver le statut d'un simple comptage de lignes dans `messages` — insuffisant pour distinguer un run en erreur d'un run qui n'a simplement rien trouvé après filtrage.

**Chaque étape du run est un step Vercel Workflow distinct** (lecture/validation CSV → normalisation → filtrage par mot-clé → déduplication + écriture), conformément au mécanisme d'orchestration déjà acté. Alternative écartée : un traitement synchrone en un seul bloc — plus simple à écrire, mais un réessai après erreur réimporterait l'intégralité du fichier plutôt que de reprendre à l'étape en échec.

## Risks / Trade-offs

- **[Risque]** Un mot-clé mal choisi (trop générique ou trop restrictif) peut produire un volume de messages non représentatif → **Mitigation** : le choix reste entièrement à la charge de l'utilisateur, cohérent avec la nature « simulation » du mot-clé de marque définie au PRD ; aucune validation métier du mot-clé n'est imposée par le système.
- **[Risque]** Une normalisation incomplète (espace, casse) fausserait à la fois la déduplication et le filtrage → **Mitigation** : la normalisation est une étape unique appliquée avant filtrage et déduplication, testée explicitement sur le fichier de référence `social-media-sentiments_analysis.csv`.
- **[Risque]** Écriture depuis un service Python dans une table dont le schéma est possédé par Drizzle (TypeScript), sans ORM Python propre → risque de divergence de schéma → **Mitigation** : la migration Drizzle (table `messages` + `import_runs`) est appliquée en amont côté `insight-hub-web` ; le pipeline Python n'exécute jamais de DDL, uniquement des requêtes SQL simples sur des colonnes déjà déployées (déjà acté en ARCHITECTURE.md).
- **[Risque]** Le support Python de Vercel Workflows est en beta → **Mitigation** : chaque step est écrit comme une fonction pure testable indépendamment du framework d'orchestration ; repli identifié vers Inngest Python si la beta bloque réellement.
- **[Trade-off]** La déduplication stricte (hash de champs exacts) est plus simple et rapide qu'une comparaison par similarité, mais deux messages quasi identiques (ex. une faute de frappe corrigée) resteront comptés comme deux messages distincts — jugé acceptable pour un outil de reporting, pas un outil anti-spam.

## Migration Plan

1. Ajouter et appliquer la migration Drizzle côté `insight-hub-web` créant les tables `messages` et `import_runs` sur Neon, avant tout déploiement du pipeline.
2. Déployer le service `insight-hub-pipeline` avec la route d'import et les steps Vercel Workflow correspondants.
3. Valider le comportement sur le fichier de référence `social-media-sentiments_analysis.csv` avec un mot-clé de test, en vérifiant normalisation, filtrage et absence de doublons.
4. Rollback : aucune opération destructive côté données existantes — un run raté n'affecte que les lignes portant son propre `run_id` ; une purge ciblée par `run_id` permet une reprise à froid si nécessaire.

## Open Questions

- Le nom exact et le typage définitif des colonnes de `messages`/`import_runs` seront arrêtés lors de l'écriture de la migration Drizzle (propriété du projet `insight-hub-web`) ; ce design présuppose des noms cohérents avec ceux listés en Decisions, sans les figer.
- Faut-il conserver le fichier CSV brut original (au-delà de Vercel Blob, dont la rétention n'est pas garantie) pour un audit a posteriori ? Non tranché par le PRD — ce change part du principe que la traçabilité par message (source + date de collecte) suffit, sans archivage du fichier source lui-même.
