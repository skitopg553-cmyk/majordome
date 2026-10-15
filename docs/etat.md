# État de Majordome

## Ce qui marche
- PWA sombre « laiton » : onglets Chat / Tâches / Mémoire en bas, icônes PNG 192/512, écran de démarrage Android.
- Chat : réponse streamée mot par mot, rendu markdown, suggestions, historique persistant (table `messages`, 30 derniers), « Nouvelle conversation ».
- Tâches : groupes En retard / Aujourd'hui / Demain / Plus tard / Sans date, ajout rapide sans IA, coche avec animation, mises à jour optimistes.
- Mémoire : souvenirs par catégorie, suppression avec confirmation.
- Fonctions Vercel à Paris (cdg1). `ai_calls` journalisé après la réponse. Anti-doublon de tâches (IA et ajout rapide).

## Bugs et limites connus
- Rien de cette session n'a été testé avec la vraie base ni la vraie IA : en local, `.env.local` est vide. Vérifié en local seulement : build + interface avec des données simulées.
- Temps « avant » estimé depuis `ai_calls` (1,5–2,3 s sans outil, 3–4 s avec un outil, jusqu'au premier mot). Temps « après » pas encore mesuré : lignes `[timing]` dans les logs Vercel. Le connecteur Vercel de Claude reçoit une erreur 403 sur les logs.
- Anti-doublon simple (égalité ou inclusion du titre) : des reformulations passent encore.
- « Nouvelle conversation » est mémorisée par navigateur (pas synchronisée entre appareils).
- Vue Tâches pas encore validée en ligne → pas cochée dans la roadmap.

## Dernière session (2026-10-15)
- docs/etat.md, chronométrage de /api/chat, région cdg1, streaming, log après réponse, table `messages` (migration 0003 appliquée), refonte du design, onglet Mémoire, PWA propre. Un commit par étape sur `main`.

## Prochaine étape
- Ruben teste sur son téléphone et relève les temps `[timing]` dans les logs Vercel. Ensuite, on coche « Vue Tâches » et on attaque les rappels push (phase 1).
