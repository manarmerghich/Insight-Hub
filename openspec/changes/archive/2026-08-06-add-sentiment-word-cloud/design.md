## Context

Le dashboard restitue déjà le sentiment sous forme de chiffres agrégés (`net-sentiment-score`, `engagement-rate-by-sentiment`) et de classements catégoriels (`top-themes-restitution`, `representative-messages-by-theme-sentiment`), mais rien ne montre le vocabulaire brut employé par les auteurs. Le texte des messages (`messages.text`) n'a jamais été tokenisé côté application : la seule structure texte existante est la colonne générée `search_vector` (`tsvector('simple', text)`), utilisée uniquement pour la recherche plein texte (`message-search`), pas pour du comptage de fréquence de mots.

Le jeu de données actuel (`social-media-sentiments_analysis.csv`) est en anglais ; le choix de la config `simple` (et non `english`/`french`) pour `search_vector` a été fait précisément parce que la langue du contenu importé n'est pas garantie (voir commentaire dans `schema.ts`). Ce nuage de mots doit composer avec la même incertitude : un filtrage de mots vides ne peut être que best-effort, pas une garantie linguistique.

## Goals / Non-Goals

**Goals:**
- Restituer, par catégorie de sentiment (positif/négatif/neutre), les mots les plus fréquents du texte des messages déjà classés, sous le scope du dernier run d'import et des filtres croisés actifs.
- Rester purement dérivé de données déjà en base (`text`, `sentiment`/`sentiment_status`, `sentiment_original`) : aucun appel IA, aucune nouvelle colonne stockée.
- Rendre la logique d'extraction (tokenisation, filtrage, comptage, classement) testable unitairement sans base de données, dans l'esprit des fonctions pures existantes (`engagementScore`, `resolveSentimentLabel`).
- Réutiliser les cartes/CSS existants (pas de nouvelle bibliothèque de rendu de nuage de mots).

**Non-Goals:**
- Pas de support linguistique garanti multi-langue pour le filtrage des mots vides (best-effort anglais, comme le jeu de données actuel).
- Pas d'analyse sémantique (lemmatisation, n-grammes, entités) — un simple comptage de tokens normalisés.
- Pas d'exclusion configurable par l'utilisateur (pas de liste de mots à bannir personnalisable) — hors scope de cette itération.

## Decisions

### Tokenisation et comptage en JavaScript, pas en SQL (`ts_stat`)
Postgres expose `ts_stat()` pour obtenir des statistiques de fréquence de mots à partir d'un `tsvector`, ce qui aurait pu réutiliser `search_vector`. Rejeté : `ts_stat()` prend en argument une sous-requête SQL sous forme de texte (pas une requête paramétrée Drizzle), ce qui complique la composition avec les conditions de filtres croisés déjà exprimées comme `SQL[]` et augmente le risque d'erreur de construction de requête. La config `simple` ne retire pas non plus les mots vides : un post-filtrage serait nécessaire de toute façon.
Retenu : une requête Drizzle classique (réutilisant `dashboardFilterConditions`) qui ne sélectionne que `text` et les colonnes de sentiment nécessaires, puis tokenisation/comptage en JavaScript avec des fonctions pures testées par Vitest — cohérent avec le reste du projet (`engagementScore`, `resolveSentimentLabel`, `mapOriginalSentimentToCategory` sont tous des calculs JS purs sur des lignes déjà chargées).

### Règles de tokenisation
- Minuscules, découpage sur tout ce qui n'est pas une lettre ou un chiffre (`/[^\p{L}\p{N}]+/u`), unicode-aware pour ne pas casser les accents.
- Tokens de moins de 3 caractères exclus (élimine une grande partie des mots vides courts sans dépendre de la langue : "a", "is", "to", "of", "le", "et"...).
- Tokens entièrement numériques exclus (années, compteurs — pas des "mots").
- Filtrage best-effort par une liste de mots vides anglais courants (~100 mots : articles, pronoms, auxiliaires, prépositions), constante `STOP_WORDS`, documentée comme best-effort à l'image de `POSITIVE_LABELS`/`NEGATIVE_LABELS` dans `original-sentiment-mapping.ts`. N'exclut pas nécessairement les mots vides d'autres langues si le contenu importé change de langue à l'avenir — non-goal explicite ci-dessus.
- Le texte des `hashtags` n'est pas inclus dans la tokenisation (déjà capturé séparément, éviter le doublon avec le texte du message).

### Classement et volume affiché
Jusqu'à 30 mots par catégorie de sentiment, triés par fréquence décroissante, égalité départagée par ordre alphabétique croissant (déterministe, pas d'aléa côté rendu). Constante ajustable (`MAX_WORDS_PER_CATEGORY`) si le retour visuel après implémentation suggère un autre volume.

### Source de sentiment et scope partagés avec les autres widgets
Même pattern que `engagement-rate-by-sentiment`/`representative-messages-by-theme-sentiment` : `NET_SENTIMENT_SOURCE` (`"ai"` ou `"csv_original"`) détermine si la catégorisation vient de `sentiment`/`sentiment_status = 'completed'` ou du mapping provisoire de `sentiment_original`. Le scope de base est le dernier run d'import (`getLatestImportRun`), restreint par `dashboardFilterConditions(filters, NET_SENTIMENT_SOURCE)` — sans exception de dimension (à la différence du classement des thèmes) : un filtre sentiment actif restreint donc normalement le résultat aux catégories correspondantes.

### Rendu visuel sans nouvelle dépendance
Pas de bibliothèque de nuage de mots (`react-wordcloud`, `d3-cloud`, etc.) : conformément à la préférence du projet pour les composants existants, le nuage est un flux de `<span>` mots dans une carte, taille de police interpolée linéairement entre une borne min et max (ex. 0.85rem → 2rem) selon la fréquence relative au mot le plus fréquent de sa catégorie, une couleur par catégorie de sentiment cohérente avec les cartes existantes (ex. Success/Warning/Text selon positif/négatif/neutre). Layout simple en `flex-wrap`, pas de positionnement physique façon nuage organique (pas de collision-detection) — compromis volontairement simple et responsive.

## Risks / Trade-offs

- [Tokenisation/comptage en JS sur chaque requête dashboard (`force-dynamic`)] → Volume de données actuel (jeu de démonstration) reste largement gérable en mémoire ; seules les colonnes `text` + sentiment sont chargées (pas la ligne complète). Si le volume croît significativement, migrer vers un calcul en SQL (`ts_stat` ou une vue matérialisée) sera à réévaluer, mais hors scope ici.
- [Liste de mots vides anglais uniquement] → Best-effort documenté ; si le contenu importé passe au français ou à une autre langue, le nuage affichera davantage de mots vides jusqu'à extension de `STOP_WORDS`. Accepté comme limite connue (non-goal).
- [Mots courts significatifs supprimés par le seuil de 3 caractères] → Perte mineure acceptée pour un gain de simplicité (pas de dépendance linguistique) ; le seuil est une constante isolée, ajustable sans changer l'architecture.

## Migration Plan

Additif uniquement, aucune migration de schéma : nouvelle fonction de requête + composant, branchement dans `dashboard/page.tsx`. Rollback = retrait du branchement (ou revert du commit), sans impact sur les autres widgets.
