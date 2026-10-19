# QA et diagnostics

## Diagnostic « ma semaine n'a créé que le lundi 19 » (19/10, lecture seule de la base)

1. **Certain** : l'IA a bien appelé les bons outils (22 `add_recurring_task`, un `add_task` pour le restaurant avec Arthur). Les règles du mardi au dimanche existent dans `recurring_tasks`.
2. **Certain** : une règle ne devient visible qu'en étant copiée dans `tasks`, et seulement quand l'app charge `/api/tasks` le jour même (`materializeToday`). Le Planning ne lit que `tasks` : les autres jours restent vides tant qu'on n'y est pas. La migration 0013 (cron) n'est pas appliquée.
3. **Certain** : quand tu as dit « tu n'as mis que pour ce lundi », l'IA a recréé les 22 règles (44 au total, doublons) : `add_recurring_task` ne détecte aucun doublon, alors qu'`add_task` le fait. Elle a répondu « tout est en place » sans rien vérifier.
4. **Certain** : le modèle de données n'a pas de notion de fin ni de plusieurs jours : un cours 9 h-13 h devient 4 éléments (« Cours », « Pause », « Cours après-midi », « Fin de cours ») avec une seule heure chacun ; « Pause » sans heure devient une tâche à minuit.
5. **Probable** : le prompt (`instructions.ts`, ligne « Ce qui REVIENT ») ne parle ni de créneau, ni de durée, ni de plusieurs jours par règle ; le modèle (gpt-4o-mini) n'a donc aucun moyen d'exprimer « lundi-vendredi 9 h-17 h » et fait une règle par jour et par heure.
6. **Probable** : le message 60 contient « [Ajout des tâches en cours...] » : le modèle raconte ses actions au lieu de s'appuyer sur le résultat des outils. Le récapitulatif doit venir du code.
7. **Hypothèse** : « Salle » le mercredi/jeudi est devenue « Pause muscul » (elle n'est pas notée comme habitude à confirmer) : il faudra la poser en habitude.
