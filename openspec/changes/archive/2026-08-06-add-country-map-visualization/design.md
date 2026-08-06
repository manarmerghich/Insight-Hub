## Context

Le widget "Messages par pays" (`DistributionCard`, `insight-hub-web/src/app/dashboard/distribution-card.tsx`) affiche aujourd'hui une liste de barres triée par volume, alimentée par `getCountryDistribution` (`src/db/message-distribution.ts`). Le champ `messages.country` est du **texte libre en anglais**, transmis quasiment tel quel depuis le CSV importé (seul `normalize_text` — collapse des espaces + trim — s'applique côté pipeline, voir `insight-hub-pipeline/app/normalize.py`) : aucun enum, aucun code ISO, aucune normalisation de valeur nulle part dans le système. Le jeu de données d'exemple contient un mélange de noms complets et d'abréviations anglaises (`Australia`, `Czech Republic`, `South Africa`, `UK`, `USA`, …).

`react-simple-maps` (mentionné dans `ARCHITECTURE.md` mais jamais intégré jusqu'ici) attend un fond de carte topojson dont chaque géométrie porte un `id` (code numérique ISO 3166-1) et des `properties.name` en anglais — pas toujours identiques aux noms attendus (ex. `"Czechia"` et non `"Czech Republic"`, `"United States of America"` et non `"USA"`). Il faut donc une couche de correspondance entre le texte libre de `messages.country` et les noms utilisés par le fond de carte.

## Goals / Non-Goals

**Goals:**
- Remplacer le widget "Messages par pays" par un widget combiné carte + classement, respectant le scope du dernier run d'import et l'ensemble des filtres croisés existants (aucun changement à `dashboard-cross-filters`).
- Permettre de basculer la coloration de la carte entre volume de messages et score de sentiment net par pays.
- Faire correspondre le plus de valeurs `country` possible à une zone de la carte, sans jamais faire échouer l'affichage pour une valeur non reconnue (dégradation : reste visible dans le classement, absente de la carte).
- Rester cohérent avec le système visuel existant (variables CSS de `globals.css`, pas de nouvelle palette).

**Non-Goals:**
- Normaliser ou corriger `messages.country` en base ou dans le pipeline (`insight-hub-pipeline`) — la correspondance reste une couche d'affichage côté web, appliquée à la lecture.
- Couvrir exhaustivement les ~195 pays reconnus par l'ONU dans la table de correspondance dès cette itération : la table couvre les valeurs déjà vues dans les données d'exemple plus les variantes anglaises courantes (abréviations, noms alternatifs usuels), extensible plus tard sans changement de schéma.
- Cliquer sur un pays de la carte pour appliquer le filtre croisé pays : le sélecteur "Pays" déjà présent dans `FilterBar` reste le seul moyen de filtrer par pays sur cette itération.
- Zoom/pan interactif sur la carte : une carte statique (projection fixe) suffit à l'usage "coup d'œil" visé.

## Decisions

### 1. Fond de carte : `world-atlas` `countries-50m.json`, servi comme asset statique local
Le paquet `world-atlas` fournit des topojson prêts à l'emploi à trois résolutions. Le fichier `countries-50m.json` (177 pays en 110m contre 241 en 50m, ~740 Ko brut) est retenu plutôt que `countries-110m.json` (105 Ko) car la résolution 110m **exclut plusieurs petits pays plausibles en social listening** (Singapour, Malte, Monaco, etc.), alors que 50m les couvre tout en restant largement suffisant pour une carte de la taille d'un widget (pas besoin de la précision de `countries-10m.json`, 3,5 Mo).

Le fichier est copié une fois dans `insight-hub-web/public/geo/world-countries-50m.json` (asset statique Next.js) plutôt qu'importé dans le bundle JS : `react-simple-maps` accepte une URL pour la prop `geography`, le fichier est alors chargé et mis en cache par le navigateur au premier affichage, sans alourdir le bundle JS envoyé sur chaque page. Alternative écartée : dépendre de `react-simple-maps` en pointant vers une URL CDN externe (l'exemple par défaut de sa doc) — rejeté pour éviter une dépendance réseau externe au moment du rendu (fiabilité, RGPD, cohérence avec l'absence d'autres appels tiers côté dashboard).

### 2. Correspondance nom de pays → nom topojson : normalisation + table d'alias, sans dépendance ISO
Chaque géométrie du fond de carte porte `properties.name` en anglais (ex. `"France"`, `"United Kingdom"`, `"Czechia"`). La correspondance se fait **par nom**, pas par code ISO numérique : plus simple, pas de dépendance supplémentaire (ex. `i18n-iso-countries`) pour une conversion nom → code dont on n'a pas besoin ailleurs dans le produit.

Nouveau module pur `src/db/country-geo-mapping.ts` :
- `resolveMapCountryName(rawCountry: string): string | null` : normalise la valeur brute (trim, casse insensible), tente une correspondance exacte insensible à la casse contre les noms topojson connus, puis une table d'alias (`COUNTRY_NAME_ALIASES`) pour les variantes courantes non exactes (`"UK"` → `"United Kingdom"`, `"USA"` → `"United States of America"`, `"Czech Republic"` → `"Czechia"`, etc.). Retourne `null` si aucune correspondance : la valeur n'est alors pas colorée sur la carte mais reste dans le classement (voir Requirement `Country Code Mapping For Map Rendering`).
- Fonction pure, testable sans base de données (même style que `tokenize`/`rankWordFrequencies` de `sentiment-word-cloud.ts`).

Alternative écartée : convertir vers un code ISO numérique via une bibliothèque tierce puis matcher sur `geo.id` — ajoute une dépendance et une étape de conversion sans bénéfice, puisque le nom suffit à matcher les géométries du fond de carte choisi.

### 3. Une carte, une bascule volume/sentiment, un classement en dessous — un seul widget
Le widget remplace entièrement `DistributionCard` pour le pays (la variante plateforme n'est pas concernée). Structure : bascule (deux boutons ou un switch, cohérent avec le style des contrôles existants), carte SVG (`ComposableMap`/`Geographies`/`Geography`), classement compact identique au format `bar-row` actuel (réutilisé pour les entrées non représentables sur la carte, dont "Non renseigné").

Nouvelle requête `getCountryDistribution` (étendue dans `message-distribution.ts`) : groupe par pays comme aujourd'hui, mais calcule en plus le score de sentiment net par pays avec la même formule et le même branchement `NET_SENTIMENT_SOURCE` (`"ai"` / `"csv_original"`) que `getNetSentimentScore`/`getEngagementRateBySentiment`, pour rester cohérent avec le reste du dashboard. `netScore` vaut `null` pour un pays sans message classé (même convention que le score net global).

### 4. Coloration : palette existante réutilisée telle quelle, pas de nouvelle échelle de couleurs
- Volume : rampe séquentielle sur la teinte Primary (`--color-primary` / `#2563EB`), intensité proportionnelle à la part du pays dans le total filtré (même donnée que la barre du classement).
- Sentiment net : rampe divergente Error → neutre → Success (`--color-error`/`--color-success` déjà définies), centrée sur un score de 0, bornée sur [-100, 100] comme le score net affiché ailleurs.
- Pays sans message : couleur neutre "pas de donnée" (variante plus claire de `--color-border`/`--color-bg`), distincte des deux rampes pour ne pas être lue comme "sentiment neutre" ou "volume nul coloré".

Ce choix respecte la contrainte projet de réutiliser la palette CSS existante plutôt que d'introduire un nouveau système de couleurs pour cette carte.

### 5. Composant client, données pré-calculées côté serveur
Comme `FilterBar`/`NetSentimentCard`, le nouveau composant (`CountryMapCard`, `"use client"`) reçoit en props les données déjà agrégées par `page.tsx` (résultat de `getCountryDistribution`) — aucun appel réseau supplémentaire depuis le client, seule l'interactivité (bascule volume/sentiment, survol/tooltip) vit côté client.

## Risks / Trade-offs

- [Table d'alias incomplète pour un futur import avec des noms de pays inattendus] → Dégradation déjà spécifiée : le pays reste visible dans le classement, simplement absent de la carte ; la table est un fichier isolé, facile à étendre sans toucher au reste du système.
- [Poids de l'asset topojson (~740 Ko brut, servi une fois et mis en cache par le navigateur)] → Acceptable pour un widget de dashboard interne à usage régulier (pas une page publique à fort trafic) ; `countries-110m.json` reste une option de repli si la taille devient un problème mesuré.
- [Petits territoires/exceptions cartographiques (ex. zones disputées) peuvent ne pas correspondre exactement aux attentes politiques de l'utilisateur] → Hors contrôle du produit (dépend du fond de carte Natural Earth utilisé par `world-atlas`) ; non traité par ce changement.
- [`react-simple-maps` n'est plus maintenu très activement (dernière version majeure 3.x)] → Reste la bibliothèque prévue par `ARCHITECTURE.md` et demandée explicitement ; ses dépendances (`d3-geo`, `topojson-client`) sont stables et largement utilisées indépendamment de l'activité du wrapper React.

## Open Questions

(aucune — les deux décisions produit ambiguës du proposal ont été tranchées avec l'utilisateur : bascule volume/sentiment pour la coloration, et remplacement de la liste par carte + classement dans le même widget.)
