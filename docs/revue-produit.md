# Revue produit — session de nuit

Point de vue : Ruben, 21 ans, alternant en BTS, freelance, très occupé, sur Android.

## Revue n°1 (16/10, après les tâches A à D)

### 7 h 30 — j'ouvre l'app en me levant. Je comprends ma journée en 5 s ?
- ✅ « Bonjour Ruben » + une phrase de résumé (tâches du jour, retards) + la carte des tâches du jour, cochables.
- ✅ Corrigé cette nuit : avec 0 tâche du jour et 1 en retard, la phrase disait « Tu as 0 tâche aujourd'hui… ». Elle dit maintenant « Rien de prévu aujourd'hui, mais 1 tâche en retard. »
- ⚠️ La 1re carte est le prochain rendez-vous, **encore fictif**. Le matin, la première information concrète est donc fausse (même avec son bandeau). → Question 3.

### 13 h — 30 s entre deux clients pour noter un truc à la voix. Ça marche du premier coup ?
- ✅ Un appui sur le point → l'écoute démarre aussitôt → l'envoi part tout seul quand on se tait → la réponse est lue à voix haute.
- ✅ Toucher le gros point pendant l'écoute = « j'ai fini, envoie ».
- ⚠️ Le tout premier appui déclenche la demande d'autorisation du micro d'Android : la première fois, ça ne marche donc pas « du premier coup ». Rien à corriger côté app ; à savoir.
- ⚠️ Après la réponse, le chat reste ouvert en plein écran : il faut le fermer à la main. → Question 4.

### 22 h — je fais le point sur ma journée et mon argent. Rassurant ou culpabilisant ?
- ✅ Finances : « Plus élevé que d'habitude » plutôt que « alerte » ou « dépassement ». Le ton reste neutre.
- ⚠️ Un budget dépassé passe en rouge (barre + montant). C'est le seul rouge de l'app. Utile, mais ça peut piquer le soir. → Question 5.
- ⚠️ Il n'y a pas encore de « bilan du soir » (phase 2) : à 22 h, rien ne résume la journée (tâches faites, dépenses du jour). L'écran « Ta semaine » (tâche H) en couvrira une partie.

### Corrigé tout de suite
- Phrase de résumé de l'Accueil (fonction testée `src/lib/summary.ts`).

### Questions pour Ruben (reprises dans docs/etat.md)
3. Tant que l'agenda est fictif, on met la carte « Aujourd'hui » (vraies tâches) **avant** le prochain rendez-vous sur l'Accueil ?
4. Après une demande vocale, le chat se referme-t-il tout seul quelques secondes après la fin de la lecture ?
5. Budget dépassé : on garde le rouge, ou on passe à un ton neutre (gris + « au-dessus du budget ») ?
