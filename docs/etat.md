# État de Majordome — 21/10/2026 (après la nuit du 20 au 21)

> Fichier réécrit (pas allongé). Détails : `docs/nuit-20-10.md` (lots, tests, migrations, décisions), `docs/decisions.md`, `docs/qa.md`, `git log`. Tests : 773 verts, build vert, 9 parcours e2e verts (`npm run e2e`), `npm run tour` sans constat. Retour arrière : tag `avant-nuit-20-10` (commit `12fe864`) + « Promote to Production » du déploiement correspondant dans Vercel.

## Ce qui marche (fusionné dans main, déployé)
- **Personnalité** : Majordome est un grand majordome britannique en français ; il vouvoie et dit « Monsieur » (prompt, phrases du code, écrans, voix OpenAI, miroir de la semaine). Franc, jamais culpabilisant.
- **Habitudes ↔ Forme** : « Oui » au bilan → séance créée dans Forme (sport déduit du titre, jour et durée du créneau, jamais de doublon). Dictionnaire de sports en code, petit modèle seulement pour un sport inconnu. Forme : semaine (faites + prévues), régularité par sport sur 4 semaines, répartition, série ; bouton « J'ai fait une séance » ; durée modifiable ; séance ponctuelle (« demain je vais courir à 7 h ») avec bilan après coup.
- **Pense-bêtes qui reviennent** : ponctuel (coché = disparu) ou récurrent (tous les jours, certains jours, X fois par semaine ; coché = fait pour aujourd'hui, revient au prochain jour prévu). Icône de répétition, progression « 1/2 », jamais dans la grille, arrêt par l'IA (« arrête de me rappeler la créatine ») ou en touchant le titre.
- **Rituels à l'ouverture** (code, sans IA) : carte sommeil le matin (coucher/lever pré-remplis, qualité en un tap), briefing « Votre journée, Monsieur », repas du moment (petit-déjeuner, déjeuner, dîner : texte ou dictée). 2 cartes au plus (bilans compris), « Plus tard » revient à l'ouverture suivante. Le briefing n'est lu qu'après un tap (« Écouter » ou la petite mascotte).
- **Voix** : `/api/tts` ElevenLabs (Flash / Multilingual v2 / v3) → OpenAI → téléphone, plafond de caractères commun, tout dans `ai_calls`. v3 expressif : l'humeur de la mascotte devient une indication d'émotion et les phrases respirent (seulement v3). Réponses de 1 à 2 phrases en mode vocal. `/voix-test` : comparaison des modèles (délai, coût, stabilité/style, avec/sans indications) et **prototype de conversation temps réel** OpenAI (« maintenir pour parler », plafond 10 min/jour, coût estimé, journalisé).
- Déjà là : calendrier (Jour/Semaine), planificateur IA du calendrier, bilan des habitudes + célébration, Finances, Forme, chat + voix, évaluation `npm run eval:ia` (39 phrases).

## Migrations
Appliquées cette nuit (additives) : `0015_bilan_ponctuel` (tasks.habit_status), `0016_pense_betes_recurrents` (recurring_tasks.per_week + table recurring_checks), `0017_sommeil_details` (sleep_logs.bed_time / wake_time / quality). Avant : toutes sauf `0006_google.sql`, `0007_push.sql`, `0013_cron_recurring.sql` (j'attends ton OK).

## Étapes manuelles
1. Mets ta clé IA dans `.env.local`, puis `npm run eval:ia` (ton « majordome », pense-bêtes qui reviennent, séances ponctuelles jamais mesurés sur le vrai modèle) ; donne-moi le score.
2. Écoute `/voix-test` en ligne et choisis la voix (ensuite je la branche dans tout le chat) ; essaie la conversation temps réel.
3. En attente : APK Android (branche `apk-github` : temps d'écran réel), rappels (`docs/rappels-setup.md`), Google (`docs/google-setup.md`).

## Limites honnêtes
- Jamais appelé contre ElevenLabs / OpenAI temps réel / la vraie base depuis cette machine : routes testées par simulation (e2e, tests unitaires), pas en production. Noms d'événements et d'URL du temps réel écrits d'après la documentation : un ajustement est possible.
- Dictée de la carte repas, son du briefing et reconnaissance vocale : non testables en automatique.
- Voix cloud pas encore branchée dans le chat (en attente de ton choix). Pas de décochage d'un pense-bête qui revient ; sommeil manuel de Forme sans coucher/lever ; liste « À faire aujourd'hui » cachée sous la barre en vue Jour (voir `docs/qa.md`).
- Coque Android et `.github/` non touchés.

## Décisions à prendre (Ruben)
choix de la voix · modèle par défaut · garder ou non le temps réel · défauts restants de qa.md.
