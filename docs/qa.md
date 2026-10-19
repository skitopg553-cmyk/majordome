# QA et diagnostics

## Diagnostic « ma semaine n'a créé que le lundi 19 » (19/10, lecture seule de la base)

1. **Certain** : l'IA a bien appelé les bons outils (22 `add_recurring_task`, un `add_task` pour le restaurant avec Arthur). Les règles du mardi au dimanche existent dans `recurring_tasks`.
2. **Certain** : une règle ne devient visible qu'en étant copiée dans `tasks`, et seulement quand l'app charge `/api/tasks` le jour même (`materializeToday`). Le Planning ne lit que `tasks` : les autres jours restent vides tant qu'on n'y est pas. La migration 0013 (cron) n'est pas appliquée.
3. **Certain** : quand tu as dit « tu n'as mis que pour ce lundi », l'IA a recréé les 22 règles (44 au total, doublons) : `add_recurring_task` ne détecte aucun doublon, alors qu'`add_task` le fait. Elle a répondu « tout est en place » sans rien vérifier.
4. **Certain** : le modèle de données n'a pas de notion de fin ni de plusieurs jours : un cours 9 h-13 h devient 4 éléments (« Cours », « Pause », « Cours après-midi », « Fin de cours ») avec une seule heure chacun ; « Pause » sans heure devient une tâche à minuit.
5. **Probable** : le prompt (`instructions.ts`, ligne « Ce qui REVIENT ») ne parle ni de créneau, ni de durée, ni de plusieurs jours par règle ; le modèle (gpt-4o-mini) n'a donc aucun moyen d'exprimer « lundi-vendredi 9 h-17 h » et fait une règle par jour et par heure.
6. **Probable** : le message 60 contient « [Ajout des tâches en cours...] » : le modèle raconte ses actions au lieu de s'appuyer sur le résultat des outils. Le récapitulatif doit venir du code.
7. **Hypothèse** : « Salle » le mercredi/jeudi est devenue « Pause muscul » (elle n'est pas notée comme habitude à confirmer) : il faudra la poser en habitude.

## Parcours « comme un utilisateur » (19/10, `npm run qa`)

Playwright, 390×844 et 360×800, données simulées réalistes (semaine complète de créneaux, pense-bêtes, 3 habitudes dont deux à confirmer, jour vide, rendez-vous à titre très long, base vide, chargement lent, « réduire les animations »). 18 captures par taille dans `captures/qa/`, regardées une par une. Contrôles automatiques : débordement horizontal, zones tactiles < 44 px, contraste (4,5:1), erreurs de console.

| # | Écran | Défaut | Gravité | État |
|---|---|---|---|---|
| 1 | Accueil | « Demain : rien à l'agenda » ignorait les créneaux qui reviennent (faux dès qu'on a décrit sa semaine) | haute | **corrigé** (le briefing calcule les créneaux des 8 prochains jours) |
| 2 | Planning | Le titre long d'une tâche ou d'un rendez-vous prenait 7 lignes dans la frise | moyenne | **corrigé** (2 lignes puis « … », la fiche montre tout) |
| 3 | Fiches (créneau, rendez-vous Google) | « Lundi 19 Octobre » : majuscule à chaque mot | basse | **corrigé** |
| 4 | Planning | Le glissement ne marchait pas sur un jour vide (zone trop petite) | moyenne | **corrigé** (zone agrandie, test e2e vert) |
| 5 | Accueil | Une habitude quotidienne peut apparaître deux fois (aujourd'hui et hier) tant qu'on n'a pas répondu | basse | non corrigé : à décider (ne garder que la plus récente par habitude ?) |
| 6 | Planning | Le formulaire « Nouvel événement » est toujours déplié et occupe un quart de l'écran | moyenne | non corrigé : à décider (le replier par défaut) |
| 7 | Planning | Un créneau de 8 h (Travail) tient sur une seule ligne : on ne voit pas sa durée | basse | non corrigé (amélioration, pas un bug) |
| 8 | Célébration | Le texte « Bien joué » passe devant les cartes (fond assombri pour que ça reste lisible) | basse | accepté |
| 9 | Toutes | Bouton clavier (au-dessus du bouton central) : 32 px visibles | — | faux positif : sa zone tactile est étendue à 44 px |

Rien trouvé sur les 36 captures : aucun débordement horizontal, aucune erreur de console, aucun contraste sous 4,5:1, aucune zone tactile réelle sous 44 px, écrans vides et chargement corrects, célébration absente avec « réduire les animations ».

**Ce que ces tests ne couvrent PAS** : tout le natif Android (réveil, temps d'écran, vibration) ; le ressenti « premium » (fluidité de la célébration, du glissement) : tu jugeras sur ton téléphone ; la vraie base et la vraie IA (les écrans reçoivent des données simulées ; l'IA se mesure avec `npm run eval:ia`, que je n'ai pas pu lancer car les clés sont vides dans .env.local) ; les écrans Finances et Forme avec données (hors périmètre de cette session).

## Calendrier (19/10, session « calendrier » : `npm run qa:calendrier`)

**Pourquoi l'IA a menti le 19/10** (lecture seule de la base) : « supprime toutes les tâches » → l'outil de suppression exigeait un identifiant par élément, il a échoué ; l'IA a quand même écrit « Tout est maintenant supprimé ». Rien ne vérifiait que la phrase correspondait à ce que les outils avaient fait. Corrigé : l'IA retrouve par titre et jour, la phrase finale est écrite par le code d'après les outils, et un échec est annoncé par le code (« ⚠️ Rien n'a été fait : … »).

Playwright, 390×844 et 360×800, semaine réelle chargée (12 pavés), chevauchements (dentiste pendant un cours, réunion pendant un cours), titre très long, deux pense-bêtes. Parcours : vue Jour, vue Semaine, créer en touchant un créneau vide, modifier toute la série, déplacer une seule fois, supprimer une fois, supprimer la série, modifier puis supprimer un ponctuel. **Tous les parcours passent dans les deux tailles.** L'API y est simulée (le planificateur, lui, est testé à part).

| # | Écran | Défaut | Gravité | État |
|---|---|---|---|---|
| 1 | Grille Jour | Le texte des pavés était centré verticalement (titre au milieu d'un cours de 3 h) | moyenne | **corrigé** (en haut du pavé) |
| 2 | Grille Semaine | Mots coupés lettre par lettre (« Cour / s ») dans les colonnes étroites | haute | **corrigé** |
| 3 | Grille Jour | Un titre très long débordait du pavé | moyenne | **corrigé** (autant de lignes que la hauteur permet, puis « … ») |
| 4 | Fiche | Boutons des jours (L M M J V S D) à 42 px en 360 px de large | basse | **corrigé** (44 px) |
| 5 | Grille Semaine, 360 px | Deux pavés qui se chevauchent dans une colonne font ~20 px de large : pas de texte, seulement la couleur | basse | non corrigé : accepté (toucher ouvre la fiche ; la vue Jour montre tout) |
| 6 | Grille | Un événement de 20 min fait 22 px de haut (< 44 px) | basse | non corrigé : la hauteur suit la durée, comme Google Agenda |
| 7 | Grille | Appui long pour déplacer, poignée pour allonger | — | non fait (bonus jugé risqué sans essai sur un vrai téléphone) |
| 8 | Fiche | Pas de bouton « Annuler » après une modification à la main (seulement une confirmation avant de supprimer) | basse | non corrigé |

**Ce que ces tests ne couvrent PAS** : la vraie IA (`npm run eval:ia` n'a pas pu tourner : clés vides dans .env.local) ; l'écriture dans la vraie base (`applyOps` n'a tourné que contre la simulation) ; les gestes sur un vrai téléphone (glisser pour changer de jour pendant qu'on fait défiler la grille) ; les rendez-vous Google dans la grille (Google pas connecté) ; la lecture vocale du récapitulatif.
