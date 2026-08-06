## Why

La répartition par pays est aujourd'hui affichée sous forme de simple liste de barres ("Messages par pays"), sans coup d'œil géographique et sans lecture du sentiment par zone. L'architecture prévoit déjà une "Carte / classement pays" via `react-simple-maps`, mais cette bibliothèque n'a encore jamais été intégrée. Une carte permet de repérer d'un regard les pays les plus représentés ou les plus en difficulté côté sentiment, ce qu'une liste seule ne permet pas.

## What Changes

- Ajout de la dépendance `react-simple-maps` (embarque ses propres dépendances `d3-geo`/`topojson-client`) et d'un fond de carte topojson mondial embarqué localement dans le projet (asset statique servi par Next.js, pas de dépendance réseau externe à l'exécution).
- Remplacement du widget "Messages par pays" (liste de barres) par un widget combiné carte + classement : la carte du monde colore chaque pays reconnu, un classement compact reste affiché sous la carte (même format que l'actuel : libellé, barre, valeur), incluant "Non renseigné" et tout pays non représentable sur la carte.
- Ajout d'un contrôle de bascule sur ce widget permettant de choisir la métrique de coloration de la carte : volume de messages (métrique déjà existante) ou score de sentiment net par pays (nouvelle métrique, calculée comme le score de sentiment net global mais par pays).
- Ajout d'une table de correspondance nom de pays → code ISO 3166-1 (numérique, utilisé par le fond de carte) pour rattacher les valeurs texte libre du champ `messages.country` aux entités géographiques de la carte ; les pays non reconnus (orthographe inattendue, valeur absente du référentiel) restent visibles dans le classement mais ne colorent aucune zone de la carte.
- Cette carte respecte les filtres croisés déjà en place (période, plateforme, pays, sentiment, thème) et le scope du dernier run d'import, comme le reste du dashboard.

## Capabilities

### New Capabilities
(aucune)

### Modified Capabilities
- `platform-country-distribution` : la visualisation de la répartition par pays devient une carte interactive + classement (au lieu d'une simple liste de barres), avec une nouvelle métrique de score de sentiment net par pays et une bascule volume/sentiment pour colorer la carte.

## Impact

- **Code affecté** : `insight-hub-web/src/app/dashboard/page.tsx`, `distribution-card.tsx` (remplacé pour le pays par un nouveau composant), nouveau module `src/db/country-sentiment-distribution.ts` (ou extension de `src/db/message-distribution.ts`), nouvelle table de correspondance pays → code ISO.
- **Dépendances** : ajout de `react-simple-maps` dans `insight-hub-web/package.json`, ajout d'un fichier topojson (dérivé de `world-atlas`) comme asset statique du projet (`public/`).
- **Aucun impact schéma/BDD** : `messages.country` reste du texte libre, aucune migration nécessaire.
- **Aucun impact pipeline** : le mapping nom → code ISO est purement côté web, à l'affichage.
