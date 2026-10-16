# État de Majordome

## Ce qui marche
| Section | État | Détail |
|---|---|---|
| Majordome (point central + chat plein écran) | **Réel** | Réponse streamée, markdown, historique (table `messages`), dictée + lecture à voix haute, repli clavier |
| Accueil | **Mixte** | Salutation, résumé et tâches du jour **réels** ; finances / forme **réelles dès que leurs tables existent**, sinon aperçu ; RDV et « À valider » **fictifs** (bandeau) |
| Planning | **Mixte** | Tâches **réelles** (vue jour/semaine, ajout rapide sans IA, coche, « Demain », anti-doublon) ; RDV **fictifs** (phase 2) |
| Finances | **Prêt, en aperçu** | Import CSV + catégorisation + budgets + « plus élevé que d'habitude » codés et testés ; aperçu fictif tant que la migration 0004 n'est pas appliquée |
| Forme | **Prêt, en aperçu** | Saisie sommeil / séances + semaine codées ; aperçu tant que 0005 n'est pas appliquée ; pas et temps d'écran fictifs (pas de source) |
| Ta semaine (miroir) | **Aperçu** | Vrai calcul sur une semaine fictive (phase 6) |
| Profil (avatar) | **Réel** | Mémoire & objectifs, voix, rappels (« Bientôt disponible »), nouvelle conversation, déconnexion |

Aussi : PWA, Vercel à Paris (cdg1), `ai_calls` journalisé après réponse, **100 tests** (`npm test`), captures 390×844 (`npm run captures`, serveur lancé avec `MAJORDOME_ACCESS_CODE=test-local`).

## Bugs et limites connus
- Rien de la session de nuit n'a été testé contre la vraie base ni la vraie IA (`.env.local` vide). La voix réelle n'est pas testée sur Android.
- Temps « après » de `/api/chat` pas mesuré (`[timing]` dans les logs Vercel ; le connecteur Vercel de Claude reçoit une erreur 403).
- `npm audit` : 2 failles critiques + 1 modérée dans **vitest/tinypool (tests uniquement, jamais déployé)**. Passer à vitest 4 échoue sur un bug npm (`edgesOut`) même avec un lockfile neuf.
- Anti-doublon simple (égalité ou inclusion du titre). « Nouvelle conversation » et réglages mémorisés par navigateur.

## Dernière session (nuit du 15 au 16/10, branche `nuit`)
Voir le Journal de nuit ci-dessous. Rien n'est mergé dans `main`.

## Prochaine étape
- Branche `nuit` fusionnée dans `main` et validée sur téléphone (16/10). Suite : activer les rappels (dernière case de la phase 1).

## Session de nuit
- Mode d'emploi : `docs/nuit.md`. Scripts : `scripts/nuit-tache.ps1` (crée la tâche planifiée) et `scripts/nuit-run.ps1`.
- **Tâche planifiée « Majordome-nuit » introuvable** à 01 h 31 (`Get-ScheduledTask`) : le script n'a sans doute pas abouti. Relancer `powershell -ExecutionPolicy Bypass -File scripts\nuit-tache.ps1` dans un terminal pour voir l'erreur.
- Veille sur secteur : déjà sur « jamais », rien changé. Pour remettre 30 min : `powercfg /change standby-timeout-ac 30`.
- Aperçu Vercel de la branche : https://majordome-git-nuit-skitopg553-cmyks-projects.vercel.app (connexion Vercel requise).

## Journal de nuit
- A — outillage vitest + Playwright, contraste du gris relevé (4,6:1), interrupteur voix.
- B — logique voix testée (`src/lib/voice.ts`), toucher le point = finir et envoyer.
- C — Planning : vue Jour / Semaine, « Demain » en un geste (testé été/hiver).
- D — Finances : CSV (`;`/`,`, « -1 234,56 », JJ/MM/AAAA, Débit/Crédit, Windows-1252), règles `src/lib/finance/categories.json` + Haiku pour l'inconnu, budgets, « > 2× la médiane sur 90 j », objectifs avec image, anti-doublon à la réimport.
- E — Forme : détection du sport dans les titres d'agenda, semaine L→D, saisie séance / nuit.
- F — Phase 2 désactivée : pré-filtre des mails (20 exemples), connexion Google lecture seule derrière `GOOGLE_ENABLED`, `docs/google-setup.md`.
- G — Rappels préparés : service worker, abonnement, envoi (`web-push`), `docs/rappels-setup.md`.
- H — Miroir préparé : `weekSummary` + `weeklyPrompt`, écran « Ta semaine » en aperçu.
- I — Accueil branché sur les vraies données dès qu'elles existent, squelettes, animations réduites, ~220 Ko JS gzip.
- Audit (`/ponytail-audit`) — corrigé : versions figées + `package-lock.json` commité (fini les « latest »), coche annulée proprement hors ligne, rappel non perdu si l'envoi échoue, jours accentués (décembre…) en vue semaine, dictée gardée si une réponse est en cours, test de l'anti-doublon. Restent (petits) : 6 copies de la fonction « sans accents », 5 copies de l'aide fetch, comparaison du code d'accès non constante en temps.
- Revues produit 1 à 3 : `docs/revue-produit.md`.

## Questions pour Ruben
- Tranchées le 16/10 : Q3 « Aujourd'hui » avant le RDV fictif (fait) ; Q4 le chat se referme 3 s après une réponse vocale, annulé dès qu'on touche l'écran (fait, pas testé sur téléphone) ; Q5 budget dépassé en gris + « Au-dessus du budget de X € », plus de rouge (fait).
- Encore ouvertes : la tâche planifiée de nuit (script n'a pas abouti) ; Q6 ta banque exporte-t-elle le CSV depuis son appli mobile ? ; Q7 bilan « Ta semaine » dimanche soir ou lundi matin ?

## Migrations
- **Appliquées le 16/10** : `0004_finances` (transactions, budgets, savings_goals) et `0005_forme` (sleep_logs, workouts). Tables vides, RLS activé. Finances et Forme passent donc en mode réel (écran « Commence par un relevé »).
- Écrites, **non appliquées** : `0006_google.sql` (Google), `0007_push.sql` (rappels). Rappels reportés : l'app n'est pas encore installée sur l'écran d'accueil.

## Variables d'environnement à ajouter (Vercel, quand tu actives)
- Google (phase 2) : `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `GOOGLE_ENABLED=true` → `docs/google-setup.md`.
- Rappels : `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET` (+ le même dans le Vault Supabase) → `docs/rappels-setup.md`.
