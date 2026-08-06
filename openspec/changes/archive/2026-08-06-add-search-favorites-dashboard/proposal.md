## Why

Le dashboard ne permet aujourd'hui de consulter les messages qu'à travers des agrégats (scores, répartitions, classements) et quelques messages représentatifs isolés (pics, thèmes). Un responsable marketing qui veut retrouver la preuve concrète d'un signal (ex. "montre-moi les messages qui parlent de tel incident") n'a aucun moyen de chercher dans le texte des messages, ni de garder de côté les messages qu'il juge marquants pour les retrouver ensuite ou les citer dans un rapport. Le PRD et l'architecture prévoient cette capacité pour la V1 ("Recherche plein texte + favoris") : c'est une fonctionnalité de restitution pure, sans dépendance IA, qui peut s'appuyer sur les filtres croisés déjà en place.

## What Changes

- Ajouter une barre de recherche plein texte sur le dashboard, portant sur le texte des messages, scopée au dernier run d'import (comme les autres KPIs) et combinable en ET avec les filtres croisés existants (période, plateforme, pays, sentiment, thème).
- Afficher les messages correspondants sous forme de liste (texte, auteur, plateforme, date, sentiment), triés par pertinence puis par date ; état vide dédié si aucun résultat.
- Ajouter la persistance en base d'un indicateur "favori" par message (colonne + index), sans dépendance à un système d'authentification (l'application n'a pas de notion d'utilisateur connecté aujourd'hui — les favoris sont globaux au dashboard).
- Permettre de marquer/démarquer un message comme favori directement depuis la liste de résultats de recherche, via une Server Action avec mise à jour optimiste (`useOptimistic`).
- Ajouter un contrôle pour restreindre l'affichage aux seuls messages favoris (composable avec la recherche et les filtres croisés).
- Aucun nouveau calcul IA n'est déclenché par la recherche ou le marquage en favori.

## Capabilities

### New Capabilities
- `message-search`: recherche plein texte sur le texte des messages du dernier run d'import, combinable avec les filtres croisés existants, avec restitution d'une liste de messages correspondants.
- `message-favorites`: marquage/démarquage de messages comme favoris, persisté en base, et vue filtrée sur les seuls favoris depuis le dashboard.

### Modified Capabilities
(aucune — la capacité `dashboard-cross-filters` n'est pas modifiée : la nouvelle liste de résultats de recherche est un nouvel élément d'affichage qui réutilise les conditions de filtre existantes, sans changer leur comportement sur les KPIs déjà spécifiés)

## Impact

- **Schéma (`insight-hub-web`, Drizzle)** : nouvelle colonne `is_favorite` (booléen, défaut `false`) sur `messages`, nouvelle colonne générée `search_vector` (`tsvector`) indexée par un index GIN sur `messages.text`. Migration `drizzle-kit` à générer.
- **Accès aux données** : nouveau module de conditions de recherche (composable avec `src/db/dashboard-filters.ts`), nouvelle fonction de récupération de la liste de messages correspondants (scope dernier run + filtres croisés + recherche + favoris).
- **UI dashboard (`src/app/dashboard`)** : nouvelle barre de recherche, nouveau composant de liste de résultats avec bouton favori, nouveau contrôle "favoris uniquement" ; état de recherche/favoris porté par l'URL comme les autres filtres.
- **Server Action** : nouvelle action de bascule du favori par message, avec mise à jour optimiste côté client.
- Aucun impact sur `insight-hub-pipeline` (aucun nouveau traitement IA, aucune modification du pipeline d'import).
