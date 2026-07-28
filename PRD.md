# Insight Hub — Cahier des charges

Mini outil de social listening (inspiré Digimind/Onclusive) : centraliser des messages en ligne sur une marque, analyser leur sentiment et leurs thèmes via l'IA, et produire un dashboard + rapport de synthèse exploitable.

---

## 1. Le pourquoi — cadrage stratégique

### 1.1 Qui utilise l'outil, pour quoi décider ?
Persona principal : **responsable marketing/communication** qui veut un **rapport de synthèse périodique** sur la perception de sa marque. Ce n'est **pas** un community manager gérant de l'urgence en temps réel.

### 1.2 Quelle question business l'outil doit-il trancher ?
- Notre image se dégrade-t-elle ?
- Quel thème génère le plus de négatif ?
- Sur quelle plateforme/pays sommes-nous le plus exposés ?

### 1.3 Écoute réactive ou proactive ?
**Réactive** : l'outil analyse des données déjà collectées (reporting). Pas de détection de signaux faibles en amont. La détection de pic reste une analyse *a posteriori* sur l'historique, pas une alerte déclenchée en temps réel.

### 1.4 Périmètre de "la marque"
Un mot-clé/sujet simulé, avec possibilité de comparer deux mots-clés côte à côte (simulation concurrentielle). Pas de gestion multi-marques complexe.

### 1.5 Granularité temporelle
**Le jour**, pas l'heure — cohérent avec des données non issues d'un flux continu.

### 1.6 Qu'est-ce qu'un insight actionnable ici ?
Toujours **trois éléments ensemble** : un chiffre (% négatif), une comparaison (évolution ou écart à la moyenne), un exemple concret (message représentatif cité). Jamais un chiffre affiché seul.

### 1.7 Qui reçoit quoi, à quelle fréquence ?
Un **dashboard consulté à la demande**, avec export PDF à la demande. **Pas d'envoi automatique** (email/Slack) — l'outil est consulté activement, pas poussé vers l'utilisateur.

### 1.8 Niveau de confiance sur l'IA
Fiabilité garantie par un **échantillon annoté manuellement** servant de référence (objectif : **80% d'accord avec l'IA**), plutôt que par un score de confiance affiché message par message.

---

## 2. Le quoi — fonctionnalités et indicateurs clés

### A. Collecte
- Import de CSV existant, avec architecture permettant de brancher une source live plus tard sans refonte
- Normalisation systématique des champs (espaces parasites, formats de date)
- Déduplication des messages
- Filtrage par mot-clé simulant la marque suivie

### B. Analyse IA
- Sentiment en 3 classes (positif/négatif/neutre), recalculé par l'IA pour une méthode homogène (émotion fine d'origine conservée en donnée secondaire)
- Détection automatique de thèmes par l'IA (5-8 thèmes maximum) → produit une **donnée structurée** (chaque message reçoit une étiquette de thème), sans restitution dédiée à ce stade
- ❌ Extraction d'entités (produits, personnes, lieux) — non retenue, complexité non justifiée ici

### C. Indicateurs clés (KPIs)
- Sentiment Score net et son évolution dans le temps
- Répartition par plateforme et par pays
- Top mots-clés/thèmes (**restitution** — lit et trie les thèmes déjà calculés en B, aucun nouveau calcul IA)
- Taux d'engagement par sentiment
- Sentiment pondéré par engagement (poids par likes/retweets plutôt qu'un comptage à égalité)
- Score de risque réputationnel par thème (volume × intensité négative)
- Tendance par thème dans le temps (montée/descente)
- ❌ Share of Voice vs vrais concurrents — non retenu (suppose des données multi-marques réelles)
- ❌ Vitesse de propagation temps réel — non retenue

### D. Dashboard & restitution
- Vue d'ensemble "santé de la marque"
- Filtres croisés : période, plateforme, pays, sentiment, thème
- Comparaison temporelle (période vs période précédente)
- Comparaison géographique visuelle (carte/classement par pays)
- Comparaison à deux mots-clés (simulation concurrentielle)
- Recherche plein texte + favoris (marquer des messages à inclure dans le rapport)
- Liste de messages représentatifs par thème/sentiment
- Nuage de mots par sentiment
- Détection de pics *a posteriori* sur la timeline (annotation visuelle des événements passés, pas une alerte active)
- Résumé exécutif généré par IA (synthèse en langage naturel à partir des KPIs déjà calculés)
- Export PDF basique (tableau + graphiques) et export PDF enrichi (+ résumé IA + favoris)

### E. Alerting
❌ Non retenu — pas de seuils configurables, pas de notification automatique (email/Slack). La détection de pic reste visuelle dans le dashboard.

### F. Fiabilité & gouvernance
- Traçabilité de chaque message (source, date de collecte), conservée systématiquement
- Validation de fiabilité via échantillon annoté en amont (objectif 80% d'accord IA/annotation humaine)
- ❌ Pas de correction manuelle interactive du sentiment message par message

### G. Fonctionnalité écartée
- ❌ Top contributeurs / comptes les plus engageants — ne répond à aucune des questions business définies en 1.2

---

## 3. Chaîne de dépendances

```
Fondations (aucune dépendance IA)
├─ Import CSV, normalisation, déduplication
├─ Filtrage par mot-clé (marque suivie)
├─ Traçabilité
├─ Filtres croisés (période, plateforme, pays)
├─ Recherche plein texte + favoris
└─ Comparaison géographique

        ↓ dépend de →

Sentiment IA
├─ Sentiment Score net + évolution
├─ Sentiment pondéré par engagement
├─ Nuage de mots par sentiment
├─ Détection de pics a posteriori (dépend du Sentiment Score net)
└─ Comparaison temporelle

        ↓ dépend de →

Thèmes IA (dépend du sentiment ET des thèmes)
├─ Top thèmes/mots-clés
├─ Score de risque réputationnel par thème
└─ Tendance par thème dans le temps

        ↓ dépend de →

Synthèse finale (dépend de tout le reste)
├─ Résumé exécutif généré par IA
└─ Export PDF enrichi
```

**Ordre de construction naturel : sentiment d'abord → thèmes ensuite → synthèse en dernier.**

---

## 4. Plan de développement

### MVP — répond seul aux 3 questions business
- Import CSV + normalisation + déduplication
- Filtrage par mot-clé simulant la marque suivie
- Traçabilité (source, date de collecte)
- Sentiment 3 classes (IA) + validation échantillon annoté (objectif 80%)
- Détection de thèmes par l'IA (5-8 thèmes) — donnée structurée, restitution en V1
- Sentiment Score net + évolution dans le temps
- Répartition par plateforme et par pays
- Filtres croisés (période, plateforme, pays, sentiment, thème)
- Vue d'ensemble "santé de la marque"
- Export PDF basique (tableau + graphiques)

### V1 — enrichit la lecture et la preuve
- Taux d'engagement par sentiment
- Sentiment pondéré par engagement
- Comparaison temporelle (période vs période précédente)
- Top mots-clés/thèmes
- Détection de pics a posteriori sur la timeline
- Recherche plein texte + favoris
- Liste de messages représentatifs par thème/sentiment
- Nuage de mots par sentiment
- Comparaison géographique visuelle

### V2 — analyse avancée
- Score de risque réputationnel par thème
- Tendance par thème dans le temps
- Résumé exécutif généré par IA
- Export PDF enrichi (résumé IA + favoris + graphiques clés)
- Comparaison à deux mots-clés (simulation concurrentielle)

### Hors périmètre — exclus explicitement
- Top contributeurs / comptes les plus engageants
- Alerting temps réel / seuils / notifications automatiques
- Correction manuelle interactive du sentiment message par message
- Extraction d'entités (produits, personnes, lieux)
- Share of Voice vs vrais concurrents multi-marques
- Vitesse de propagation temps réel
- Ingestion de flux live (architecture compatible future, non construite maintenant)

---

## 5. Jeu de données de référence

`social-media-sentiments_analysis.csv` — colonnes disponibles : `Text`, `Sentiment` (original, conservé en donnée secondaire), `Timestamp`, `User`, `Platform`, `Hashtags`, `Retweets`, `Likes`, `Country`, `Year`, `Month`, `Day`, `Hour`.

⚠️ Le fichier brut contient des espaces parasites dans plusieurs champs texte (`Text`, `Sentiment`, `User`, `Platform`, `Country`) — la normalisation (étape MVP) doit les nettoyer avant tout traitement.
