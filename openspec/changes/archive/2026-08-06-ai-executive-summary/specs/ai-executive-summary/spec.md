## ADDED Requirements

### Requirement: Executive Summary Generation From Already-Computed KPIs
Le système SHALL générer, à la demande, une synthèse en langage naturel du dernier run d'import filtré par les filtres croisés actifs, construite exclusivement à partir des KPIs déjà calculés par le dashboard (score de sentiment net et sa tendance, thème le plus à risque et sa tendance, répartition plateforme/pays, exemple de message représentatif), sans jamais déclencher de nouvel appel IA d'analyse sur les messages bruts (sentiment ou thème).

#### Scenario: Génération pour un périmètre inédit
- **WHEN** l'utilisateur consulte le dashboard avec un périmètre (import + filtres actifs) pour lequel aucun résumé n'a encore été généré
- **THEN** le système appelle Gemini une seule fois avec les KPIs déjà calculés de ce périmètre en entrée, et affiche le texte de synthèse obtenu

#### Scenario: Aucun message importé
- **WHEN** l'utilisateur consulte le dashboard sans qu'aucun import n'ait été réalisé
- **THEN** le système n'appelle pas Gemini et affiche un état vide explicite pour le résumé exécutif

### Requirement: Actionable Insight Content Rule
Le texte de synthèse généré SHALL toujours associer, pour chaque affirmation chiffrée qu'il contient, une comparaison (évolution dans le temps ou écart à une moyenne/un autre thème) et un exemple concret sourcé depuis les KPIs fournis en entrée, conformément à la règle d'insight actionnable du PRD — jamais un chiffre isolé sans comparaison ni exemple.

#### Scenario: Prompt incluant chiffres, comparaisons et exemples disponibles
- **WHEN** le système construit la requête envoyée à Gemini pour un périmètre où une tendance et un message représentatif sont disponibles
- **THEN** le prompt fourni à Gemini inclut explicitement ces chiffres, cette comparaison et cet exemple, et demande au modèle de les citer dans la synthèse

#### Scenario: Comparaison indisponible pour ce périmètre
- **WHEN** aucune tendance n'est calculable pour le périmètre courant (filtre de période incomplet, voir `net-sentiment-temporal-comparison`)
- **THEN** le système ne demande pas à Gemini d'inventer une comparaison absente et formule le prompt pour que la synthèse se limite aux chiffres et exemples réellement disponibles

### Requirement: Single Gemini Call Per Consultation Scope, Cached Otherwise
Le système SHALL garantir au plus un appel Gemini par périmètre de consultation (identifié par le dernier run d'import, les filtres croisés actifs, et le volume de messages classés dans ce scope) : un résumé déjà généré pour un périmètre identique SHALL être réutilisé depuis le cache sans nouvel appel Gemini.

#### Scenario: Consultation identique ultérieure
- **WHEN** l'utilisateur consulte à nouveau le dashboard avec exactement le même import, les mêmes filtres actifs, et qu'aucun message supplémentaire n'a été classé depuis la dernière génération
- **THEN** le système affiche le résumé déjà stocké sans appeler Gemini

#### Scenario: Changement de filtres actifs
- **WHEN** l'utilisateur modifie un filtre croisé (période, plateforme, pays, sentiment, ou thème) par rapport à la dernière consultation
- **THEN** le système considère qu'il s'agit d'un périmètre différent et génère un nouveau résumé si aucun n'existe déjà pour ce nouveau périmètre

#### Scenario: Nouveaux messages classés depuis le dernier résumé
- **WHEN** des messages supplémentaires ont terminé leur classification sentiment et/ou thème depuis la dernière génération d'un résumé pour ce périmètre
- **THEN** le système considère le résumé existant obsolète et en génère un nouveau plutôt que de servir l'ancien

### Requirement: Graceful Degradation On Summary Failure
Le système SHALL afficher un état "résumé indisponible" explicite, sans faire échouer le chargement du reste du dashboard, lorsque la génération du résumé échoue, dépasse son délai, ou retourne une réponse invalide.

#### Scenario: Échec ou délai dépassé côté génération
- **WHEN** l'appel de génération du résumé échoue, dépasse son délai, ou retourne une réponse qui ne respecte pas le format attendu
- **THEN** le dashboard affiche un état "résumé indisponible pour le moment" pour cette carte uniquement, et les autres KPIs du dashboard restent affichés normalement

#### Scenario: Le pipeline ne remonte jamais d'exception non gérée
- **WHEN** une erreur survient pendant l'appel Gemini ou l'écriture du résultat en base côté pipeline
- **THEN** l'endpoint de génération retourne un statut d'erreur explicite plutôt que de lever une exception non gérée, cohérent avec le comportement déjà garanti par la classification sentiment/thème

### Requirement: Dashboard Executive Summary Display
Le système SHALL afficher, sur la page dashboard, une carte "Résumé exécutif" présentant le texte de synthèse généré pour le périmètre courant, visuellement cohérente avec les autres cartes du dashboard.

#### Scenario: Résumé disponible
- **WHEN** un résumé a été généré ou est disponible en cache pour le périmètre courant
- **THEN** le dashboard affiche la carte "Résumé exécutif" avec le texte de synthèse correspondant

#### Scenario: Résumé en cours de génération
- **WHEN** le résumé n'est pas encore disponible en cache et que la génération est en cours pour le périmètre courant
- **THEN** le dashboard affiche un état de chargement explicite pour cette carte, sans bloquer l'affichage des autres KPIs
