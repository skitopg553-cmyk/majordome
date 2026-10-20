# État de Majordome — 19/10/2026 (session « calendrier »)

> Fichier réécrit (pas allongé). Détails : `git log`, `docs/decisions.md`, `docs/qa.md`, `docs/nettoyage.md`. Tests : 692 verts, build vert, 5 parcours e2e verts, parcours calendrier (390×844 et 360×800) tous verts.

## Ce qui marche (dans le code, fusionné dans main)
- **Calendrier** : grille Jour (0 h-24 h, défile vers l'heure actuelle, pavés de la hauteur de leur durée, côte à côte s'ils se chevauchent, ligne de l'heure) et Semaine (7 colonnes, lisible en 360 px). Toucher un vide = créer à cette heure ; toucher un pavé = fiche : titre, jour, début, fin, répétition (jours à cocher), « cette fois seulement » ou « toute la série », supprimer. Bouton +. Rendez-vous Google en lecture seule.
- **Corrigé le 20/10** : rappels aussi pour les cours/boxe (quand les rappels seront activés), fiche d'un pense-bête sans heure, chat sans « OK » ni heure coupée, Accueil sans « 0 tâche », mot « pense-bête » partout.
- **Pense-bêtes** à part : sous la grille (« À faire aujourd'hui ») et sur l'Accueil, jamais dans la grille.
- **IA** : créer, modifier, supprimer (une fois, la série, une période, tout), lister, par titre et jour, sans jamais afficher d'identifiant. La phrase « Fait : … » est écrite par le code d'après ce qui a vraiment été fait ; un échec est dit (« ⚠️ Rien n'a été fait »). « Supprime tout » : carte avec le nombre exact, puis Annuler 10 s. Fin manquante : « Jusqu'à quelle heure ? ». Titres courts (« Cours »), « Fin de cours » = heure de fin, pause ≠ événement, anti-doublon.
- **Évaluation** : `npm run eval:ia` (39 phrases dont ta semaine réelle, envoyée deux fois, supprime tout, décaler la boxe, supprimer le cours de mardi après-midi une fois, boxe sans fin, dentiste, poubelles), sur le vrai planificateur, base en mémoire.
- Déjà là : bilan des habitudes + célébration, briefing, Finances, Forme, chat + voix, migration 0014 appliquée.

## Migrations : toutes appliquées sauf `0006_google.sql`, `0007_push.sql`, `0013_cron_recurring.sql` (j'attends ton OK). Cette session n'en ajoute aucune.

## Étapes manuelles (une par une)
1. ~~Nettoyage et semaine~~ **Fait le 19/10** : 36 règles et 6 copies supprimées, ta semaine réelle enregistrée (12 créneaux avec fin, O'Tacos jusqu'à 23 h ; boxe et muscu = habitudes). Vérifie-la dans le Planning.
2. **Évaluation de l'IA** : mets ta clé IA dans `.env.local` (jamais dans le chat), puis `npm run eval:ia` ; donne-moi le score et les phrases ratées.
3. **Voix (20/10)** : ElevenLabs branché (Flash / Multilingual v2 / v3, stabilité et style réglables) sur `/api/tts` et `/voix-test`, repli OpenAI puis téléphone, plafond partagé. À toi : écouter sur `/voix-test` en ligne et choisir ; ensuite je branche la voix dans tout le chat. Mode vocal : réponses de 1 à 2 phrases. Jamais testé contre ElevenLabs en local (clés seulement dans Vercel). En attente : APK Android, rappels (`docs/rappels-setup.md`), Google (`docs/google-setup.md`).

## À tester sur téléphone
Vue Jour et Semaine (lisibilité, défilement, glisser pour changer de jour) · toucher un vide pour créer · modifier « cette fois » / « toute la série » · supprimer · dicter ta semaine (récap lu à voix haute) · « décale la boxe à 19 h » · « supprime tout » (carte, puis Annuler) · « j'ai boxe à 18 h 30 » (question) · pense-bêtes sous la grille.

## Limites honnêtes
- L'IA n'a jamais été mesurée sur ces phrases (clés vides ici) : le score de `eval:ia` est la vraie réponse.
- L'écriture dans la vraie base par le calendrier n'a pas encore tourné en production : les tests utilisent une base simulée.
- Non faits : glisser-déplacer et poignée pour allonger, Annuler après une modification à la main, vue Mois. Petits événements (< 30 min) bas et deux pavés superposés étroits en vue Semaine (voir qa.md).
- Coque Android non touchée.

## Décisions à prendre (Ruben)
défauts restants de qa.md · choix du modèle de voix (après écoute) · modèle par défaut.
