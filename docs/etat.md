# État de Majordome

## Ce qui marche
- Chat protégé par code d'accès, agent avec outils (tâches, mémoire), contexte injecté à chaque message.
- Chaque appel IA journalisé dans `ai_calls`.
- Anti-doublon sur `add_task` (comparaison du titre normalisé, en code).
- Onglet « Tâches » : liste à cocher (en cours + 10 dernières terminées).

## Bugs et limites connus
- L'historique du chat disparaît au rechargement.
- Anti-doublon simple : deux formulations différentes d'une même tâche passent encore.
- Vue Tâches pas encore validée en ligne par Ruben.

## Dernière session (2026-10-15)
- Dépôt cloné dans `C:\Users\cerqueira ruben\dev\majordome`.
- Anti-doublon `add_task` + vue Tâches, poussés sur `main`.

## Prochaine étape
- Session « rapide et agréable » : vitesse, historique persistant, design, onglet Mémoire, PWA.
