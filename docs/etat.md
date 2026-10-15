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

## Session de nuit (branche `nuit`)
- Mode d'emploi pour l'agent : `docs/nuit.md`. Scripts : `scripts/nuit-tache.ps1` (crée la tâche planifiée) et `scripts/nuit-run.ps1` (un run, sortie dans `nuit.log`).
- **Tâche planifiée pas encore créée** : elle lance `claude` avec `--dangerously-skip-permissions`, à valider et lancer par Ruben. Avant, il faut reconnecter la CLI (`claude` dans un terminal puis `/login`) : le test du 16/10 a échoué (erreur 401, jeton invalide).
- Veille sur secteur : déjà sur « jamais » (`powercfg /query` → 0), rien changé. Pour remettre une veille après 30 min : `powercfg /change standby-timeout-ac 30`.

## Journal de nuit
- A (16/10, 00 h 40) : existant vérifié par captures Playwright ; outillage vitest + Playwright (`npm test`, `npm run captures`) ; contraste du gris discret relevé (4,6:1), heure des RDV non répétée, interrupteur pour la voix.
- B (16/10, 01 h) : logique voix extraite dans `src/lib/voice.ts` (état du point, texte à lire, choix de la voix fr) + 9 tests ; capture de l'état « écoute » avec faux micro ; toucher le gros point = finir et envoyer.
- C (16/10, 01 h 30) : vue Jour / Semaine dans le Planning, bouton « Demain » (reporter en un geste, même heure ou 9 h, testé été/hiver), API PATCH accepte `due_at`. 18 tests.
- **Arrêt du run (limite d'usage atteinte)** : reste D (Finances), E, F, G, H, I et la revue produit. Aucune migration écrite pour l'instant.
- Questions pour Ruben : 1) Valides-tu la tâche planifiée (`scripts/nuit-tache.ps1`, lance `claude` sans contrôle de permissions) ? 2) Reconnecte la CLI (`claude` puis `/login`) avant.
- Aperçu Vercel de la branche : https://majordome-git-nuit-skitopg553-cmyks-projects.vercel.app (protégé par la connexion Vercel).
