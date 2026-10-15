# État de Majordome

## Ce qui marche
| Section | État | Détail |
|---|---|---|
| Majordome (orbe + chat plein écran) | **Réel** | Réponse streamée, markdown, historique (table `messages`), dictée Web Speech + lecture à voix haute, repli clavier |
| Accueil | **Mixte** | Salutation, résumé et tâches du jour **réels** ; prochain RDV, solde + courbe, objectif (photo), « Ta forme », « À valider » **fictifs** (bandeau sur chaque carte) |
| Planning | **Mixte** | Tâches **réelles** (ajout rapide sans IA, coche, anti-doublon) ; RDV **fictifs** (phase 2, étiquette « fictif ») |
| Finances | **Fictif** | Coquille style Revolut, données de `src/lib/demo-data.ts` (phase 4) |
| Forme | **Fictif** | Sommeil, pas, séances, discipline, temps d'écran (phase 5) |
| Profil (avatar) | **Réel** | Mémoire & objectifs (suppression), réglage voix, nouvelle conversation, déconnexion |

Aussi : PWA (icônes PNG, écran de démarrage), fonctions Vercel à Paris (cdg1), `ai_calls` journalisé après réponse.

## Bugs et limites connus
- Rien n'a été testé avec la vraie base ni la vraie IA (`.env.local` vide). En local, j'ai vérifié le build et les écrans avec des données simulées. La voix (micro + lecture) n'est pas testée : à essayer sur Android.
- Temps « avant » estimé depuis `ai_calls` (1,5–2,3 s sans outil, 3–4 s avec un outil). Temps « après » pas mesuré (`[timing]` dans les logs Vercel ; le connecteur Vercel de Claude reçoit une erreur 403).
- Anti-doublon simple (égalité ou inclusion du titre).
- « Nouvelle conversation » et le réglage voix sont mémorisés par navigateur.
- Vue Tâches/Planning pas encore validée en ligne → pas cochée dans la roadmap.

## Dernière session (2026-10-16)
- Nouvelle identité « majordome. » (#050506, #6CF2FF, Poppins) et Accueil refait d’après la maquette Stitch (`design/stitch/`) : RDV, tâches, solde + courbe, objectif avec photo, forme, « À valider ». Corrigé : la salutation affichait toujours « Bonsoir » (heure lue en NaN).

## Prochaine étape
- Ruben teste sur son téléphone (voix comprise) et relève `[timing]`. Ensuite : cocher la vue Tâches, puis les rappels push (phase 1).
