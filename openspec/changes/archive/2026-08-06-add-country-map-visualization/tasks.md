## 1. Dépendances et fond de carte

- [x] 1.1 Ajouter `react-simple-maps` (et `@types/react-simple-maps` si nécessaire) aux dépendances de `insight-hub-web`.
- [x] 1.2 Récupérer `countries-50m.json` du paquet `world-atlas` et le placer en asset statique dans `insight-hub-web/public/geo/world-countries-50m.json`.
- [x] 1.3 Vérifier que les noms de pays présents dans les fixtures/exemples du repo (`Australia`, `Austria`, `Brazil`, `Canada`, `Czech Republic`, `Denmark`, `France`, `Germany`, `Greece`, `India`, `Italy`, `Japan`, `Netherlands`, `Portugal`, `South Africa`, `Spain`, `Sweden`, `Switzerland`, `UK`, `USA`) correspondent bien (directement ou via alias) à des `properties.name` du fichier topojson choisi.

## 2. Correspondance nom de pays → carte

- [x] 2.1 Créer `src/db/country-geo-mapping.ts` avec `resolveMapCountryName(rawCountry: string): string | null` : normalisation (trim, casse insensible), correspondance exacte contre les noms topojson connus, puis table `COUNTRY_NAME_ALIASES` pour les variantes courantes (`UK`→`United Kingdom`, `USA`→`United States of America`, `Czech Republic`→`Czechia`, et autres alias anglais usuels : `South Korea`, `North Korea`, `Ivory Coast`→`Côte d'Ivoire`, `DR Congo`/`Democratic Republic of the Congo`→`Dem. Rep. Congo`, `Congo-Brazzaville`/`Republic of the Congo`→`Congo`, `Bosnia`/`Bosnia and Herzegovina`→`Bosnia and Herz.`, `Dominican Republic`→`Dominican Rep.`, `Central African Republic`→`Central African Rep.`, `Equatorial Guinea`→`Eq. Guinea`, `Western Sahara`→`W. Sahara`, `Macedonia`/`North Macedonia`→`Macedonia`, `Swaziland`→`eSwatini`, `Burma`→`Myanmar`, `East Timor`→`Timor-Leste`).
- [x] 2.2 Écrire `country-geo-mapping.test.ts` (Vitest) : correspondance exacte, alias connus, casse/espaces variables, valeur non reconnue → `null`, valeur vide/absente → `null`.

## 3. Données : sentiment net par pays

- [x] 3.1 Étendre `getCountryDistribution` (`src/db/message-distribution.ts`) pour retourner, en plus de `label`/`messageCount`/`share`, un `netScore: number | null` par pays, calculé avec la même formule et le même branchement `NET_SENTIMENT_SOURCE` (`"ai"`/`"csv_original"`) que `getNetSentimentScore`/`getEngagementRateBySentiment` (voir design.md §3).
- [x] 3.2 Ajouter des tests sur le calcul du score net par pays (pays avec messages classés, pays sans message classé → `null`), en s'inspirant des tests existants sur des fonctions de calcul similaires.

## 4. Composant carte + classement

- [x] 4.1 Créer `CountryMapCard` (`"use client"`) dans `src/app/dashboard/country-map-card.tsx` : bascule volume/sentiment, `ComposableMap`/`Geographies`/`Geography` pointant sur `/geo/world-countries-50m.json`, coloration via une rampe séquentielle (Primary) pour le volume et divergente (Error → neutre → Success) pour le sentiment, tooltip au survol (pays, volume, part, score net si disponible).
- [x] 4.2 Ajouter le classement compact sous la carte, réutilisant le style `bar-list`/`bar-row` existant, incluant "Non renseigné" et tout pays non représentable sur la carte (voir Requirement: Country Code Mapping For Map Rendering).
- [x] 4.3 Gérer l'état vide (aucun message importé) pour la carte et le classement, cohérent avec le pattern `empty-state` existant.
- [x] 4.4 Ajouter les classes CSS nécessaires dans `globals.css` (rampes de couleur, tooltip, contrôle de bascule) en réutilisant les variables de palette existantes, sans en introduire de nouvelles.

## 5. Intégration dashboard

- [x] 5.1 Dans `src/app/dashboard/page.tsx`, remplacer le `DistributionCard` "Messages par pays" par `CountryMapCard`, en conservant `DistributionCard` pour "Messages par plateforme".
- [x] 5.2 Vérifier que les filtres croisés actifs (période, plateforme, pays, sentiment, thème) continuent de s'appliquer à la carte comme au classement, sans changement à `dashboard-cross-filters`.

## 6. Vérification

- [x] 6.1 Lancer `npm test` (Vitest) et corriger toute régression.
- [x] 6.2 Tester avec Playwright : affichage de la carte et du classement avec des données importées, bascule volume/sentiment, tooltip au survol, état vide sans import, responsive (mobile/desktop), cohérence avec les filtres croisés actifs.
