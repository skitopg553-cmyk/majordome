# État de Majordome — 19/10/2026 (session « calendrier »)

> Fichier réécrit (pas allongé). Détails : `git log`, `docs/decisions.md`, `docs/qa.md`, `docs/nettoyage.md`. Tests : 692 verts, build vert, 5 parcours e2e verts, parcours calendrier (390×844 et 360×800) tous verts.

## Ce qui marche (dans le code, fusionné dans main)
- **Calendrier** : grille Jour (0 h-24 h, défile vers l'heure actuelle, pavés de la hauteur de leur durée, côte à côte s'ils se chevauchent, ligne de l'heure) et Semaine (7 colonnes, lisible en 360 px). Toucher un vide = créer à cette heure ; toucher un pavé = fiche : titre, jour, début, fin, répétition (jours à cocher), « cette fois seulement » ou « toute la série », supprimer. Bouton +. Rendez-vous Google en lecture seule.
- **Pense-bêtes** à part : sous la grille (« À faire aujourd'hui ») et sur l'Accueil, jamais dans la grille.
- **IA** : créer, modifier, supprimer (une fois, la série, une période, tout), lister, par titre et jour, sans jamais afficher d'identifiant. La phrase « Fait : … » est écrite par le code d'après ce qui a vraiment été fait ; un échec est dit (« ⚠️ Rien n'a été fait »). « Supprime tout » : carte avec le nombre exact, puis Annuler 10 s. Fin manquante : « Jusqu'à quelle heure ? ». Titres courts (« Cours »), « Fin de cours » = heure de fin, pause ≠ événement, anti-doublon.
- **Évaluation** : `npm run eval:ia` (39 phrases dont ta semaine réelle, envoyée deux fois, supprime tout, décaler la boxe, supprimer le cours de mardi après-midi une fois, boxe sans fin, dentiste, poubelles), sur le vrai planificateur, base en mémoire.
- Déjà là : bilan des habitudes + célébration, briefing, Finances, Forme, chat + voix, migration 0014 appliquée.

## Migrations : toutes appliquées sauf `0006_google.sql`, `0007_push.sql`, `0013_cron_recurring.sql` (j'attends ton OK). Cette session n'en ajoute aucune.

## Étapes manuelles (une par une)
1. **Nettoyage** : relis `docs/nettoyage.md` (supprimer les 36 règles et les 6 copies du 19/10), dis « OK nettoyage ».
2. **Ta semaine** : dis-moi si je l'enregistre moi-même (section 3 de nettoyage.md ; O'Tacos jusqu'à 23 h ?) ou si tu la dictes à Majordome.
3. **Évaluation de l'IA** : mets ta clé IA dans `.env.local` (jamais dans le chat), puis `npm run eval:ia` ; donne-moi le score et les phrases ratées.
4. En attente : voix (`/voix-test`), APK Android, rappels (`docs/rappels-setup.md`), Google (`docs/google-setup.md`).

## À tester sur téléphone
Vue Jour et Semaine (lisibilité, défilement, glisser pour changer de jour) · toucher un vide pour créer · modifier « cette fois » / « toute la série » · supprimer · dicter ta semaine (récap lu à voix haute) · « décale la boxe à 19 h » · « supprime tout » (carte, puis Annuler) · « j'ai boxe à 18 h 30 » (question) · pense-bêtes sous la grille.

## Limites honnêtes
- L'IA n'a jamais été mesurée sur ces phrases (clés vides ici) : le score de `eval:ia` est la vraie réponse.
- L'écriture dans la vraie base par le calendrier n'a pas encore tourné en production : les tests utilisent une base simulée.
- Non faits : glisser-déplacer et poignée pour allonger, Annuler après une modification à la main, vue Mois. Petits événements (< 30 min) bas et deux pavés superposés étroits en vue Semaine (voir qa.md).
- Coque Android non touchée.

## Décisions à prendre (Ruben)
OK nettoyage · ta semaine (je l'enregistre ou tu la dictes) · défauts restants de qa.md · voix · modèle par défaut.
