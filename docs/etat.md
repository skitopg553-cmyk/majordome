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
- D (16/10, 02 h) : Finances. Parsing CSV (`;`/`,`, guillemets, « -1 234,56 », JJ/MM/AAAA, Débit/Crédit, encodage Windows-1252), règles modifiables dans `src/lib/finance/categories.json`, Haiku pour les libellés inconnus (40 max par import), dépenses du mois, budgets, « plus élevé que d'habitude » (> 2× la médiane sur 90 j, 3 comparaisons min.), objectifs avec image. Routes `GET /api/finances` (renvoie `ready:false` sans tables → aperçu fictif) et `POST /api/finances/import` (anti-doublon à la réimport). 26 tests. **Migration `0004_finances.sql` écrite, NON appliquée.** Non testé contre la vraie base.
- Revue produit n°1 (`docs/revue-produit.md`) : phrase de résumé de l'Accueil corrigée (cas « 0 tâche aujourd'hui »), 3 questions ajoutées.
- E (16/10, 02 h 45) : Forme. Détection du sport dans les titres d'agenda (mots entiers, faux amis exclus : « Courses », « Salle de réunion »…), régularité de la semaine (7 points L→D), saisie rapide d'une séance (type + durée) et de la nuit (± 15 min). Routes `GET/POST /api/forme` (`ready:false` sans tables). Pas et temps d'écran restent fictifs (aucune source avant l'app native). **Migration `0005_forme.sql` écrite, NON appliquée.** Badge « N » de Next désactivé en dev (il masquait l'onglet Accueil). 67 tests.
- F (16/10, 03 h 15) : phase 2 préparée, **désactivée**. Pré-filtre des mails en code (`src/lib/mail-filter.ts` : expéditeurs de RDV, mots-clés, date/heure, promos écartées), testé sur 20 mails fictifs. Connexion Google lecture seule (`/api/google/connect` + `/callback`, state signé HMAC, 10 min) derrière l'interrupteur `GOOGLE_ENABLED` (vérifié : 404). Guide `docs/google-setup.md`. **Migration `0006_google.sql` écrite, NON appliquée.** 91 tests.
- G (16/10, 03 h 50) : rappels préparés. `public/sw.js`, ligne « Rappels » dans le profil (« Bientôt disponible » sans clé VAPID), `POST /api/push/subscribe`, `POST /api/push/send` (404 tant que non configuré — vérifié), logique testée (`src/lib/reminders.ts` : 5 min avant, jusqu'à 1 h après, une seule fois). Dépendance ajoutée : `web-push` (chiffrement des notifications). Guide `docs/rappels-setup.md`. **Migration `0007_push.sql` (table + colonne `reminded_at` + pg_cron/pg_net, secret lu dans le Vault) écrite, NON appliquée.** 93 tests.
- À noter : `npm audit` signale 2 vulnérabilités critiques + 1 modérée dans **vitest/tinypool (outil de test uniquement, jamais déployé)**. La mise à jour vers vitest 4 échoue sur un bug npm (`edgesOut`) : à refaire avec un `package-lock.json` propre.
