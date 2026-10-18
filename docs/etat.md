# État de Majordome

## RÉSUMÉ DU SOIR (branche `weekend`, fusionnée dans `main`) — à lire d'abord
- **Fait** : 12 tâches de `docs/soir.md`, toutes terminées : bilan « Ta semaine » réel · briefing de l'Accueil en 3 lignes (annonce demain le soir) · tâches récurrentes à la voix · raccourcis Android + partage d'un relevé · Ciqual officiel pour 166 aliments sur 261 · hors ligne (message jamais perdu, tâches en file) · coût IA −28 % de tokens · dette technique · JS de démarrage −22 % · tests de bout en bout (`npm run e2e`) · guide des rappels en 5 étapes · carte « Ta forme » réelle.
- **À FAIRE PAR TOI** : (1) appliquer dans Supabase les migrations `0011_nutrition_screen.sql` et **`0012_recurring_tasks.sql`** (et `0009`, `0010` si pas faites) ; (2) **créer la tâche planifiée** : elle a été refusée par le garde-fou de Claude Code, lance toi-même `powershell -ExecutionPolicy Bypass -File scripts\soir-tache.ps1` si tu veux d'autres runs ; (3) suivre `docs/rappels-setup.md` quand tu veux les notifications.
- **Tests sur téléphone** : réinstaller / rouvrir la PWA (raccourcis par appui long sur l'icône ; partager un relevé Revolut vers majordome.) ; dire « rappelle-moi tous les lundis de sortir les poubelles » ; couper le réseau, envoyer un message, rétablir ; ouvrir « Ta semaine ».
- **Choix faits à ta place** : une récurrence crée sa tâche au premier chargement du jour (pas de rattrapage des jours manqués) ; le partage d'un relevé lance l'import tout de suite ; l'historique envoyé à l'IA passe à 12 messages ; les 95 aliments sans code Ciqual sûr gardent des valeurs approchées.
- **Reste / à décider** : voir « À décider par Ruben » en bas. Les mesures (tokens, Ko de JS) sont dans le « Journal du soir ».


## Ancien résumé (branche `retouches`)
- **Fait** : agenda ≠ tâches (heure précise → Planning seulement ; sans heure → Accueil seulement, widget « Tâches » : retard → aujourd'hui → sans date, 5 visibles puis « +N », coche animée + vibration) · l'IA suit la règle · Planning : le jour suit le doigt avec ressort (fondu si animations réduites), date réelle « Sam. 17 oct. », point accent sur aujourd'hui · lecture de capture d'écran retirée (carte Temps d'écran = aperçu fictif ; table et route gardées) · table nutritionnelle : 138 aliments sur 261 maintenant lus dans le fichier officiel Ciqual (test sur 3 valeurs).
- **À tester sur ton téléphone** : cocher une tâche sur l'Accueil (animation + vibration) ; dire « rappelle-moi d'appeler Paul demain » (→ tâche, Accueil) puis « RDV dentiste demain à 14h » (→ agenda, Planning) ; glisser les jours du Planning avec le doigt ; toucher la date d'un autre jour (retour à aujourd'hui).
- **Choix faits à ta place** : « sans heure » = échéance à 00:00 Paris ou aucune ; tâches à venir (jours suivants) listées après « sans date » ; événement ajouté dans Planning = date + heure obligatoires ; seuls les éléments d'agenda déclenchent un rappel ; l'agenda fictif et les propositions d'agenda sont retirés de l'Accueil ; 123 aliments gardent encore des valeurs approximatives (Ciqual sans appariement sûr).
- **Migration** : aucune nouvelle (0011 déjà écrite, toujours à appliquer par toi).


## Ancien résumé (branche `soir`)
- **Fait** : 1 tout pilotable à la voix (tableau plus bas) · 2 épargne : Engagé / Libre / Mis de côté + une phrase par objectif · 3 nutrition (`log_food`, ~250 aliments, objectif kcal/macros) · 4 temps d'écran (voix, capture, Tasker) · 5 Planning refait (jour, frise des heures, semaine en points, fiche d'une tâche) · 6 verrou du code d'accès.
- **À FAIRE PAR TOI** : appliquer dans Supabase les migrations `0009`, `0010` (si pas déjà fait) et **`0011_nutrition_screen.sql`** (repas, objectif nutrition, temps d'écran). Rien n'a été appliqué par moi.
- **Tests sur téléphone** : « j'ai mangé 50 g de riz » ; « j'ai mis 200 € sur la voiture » puis Annuler ; « supprime la dépense Netflix » ; Planning : glisser à gauche/droite, toucher une tâche ; carte Temps d'écran → « Lire une capture ». Ne teste PAS le verrou en tapant 5 faux codes : tu serais bloqué 10 min.
- **Choix faits à ta place** : l'IA peut supprimer sur ta demande claire (bouton Annuler 10 s) ; aliments de la table Ciqual recopiés de mémoire, **à vérifier** (decisions.md) ; riz/pâtes = cuits ; « Libre » = revenus − charges fixes − dépenses variables − 10 %, sur les 3 derniers mois complets ; une tâche à 00:00 ou sans date = « sans heure » ; verrou d'essais en mémoire (protège surtout sur une instance) ; la capture d'écran n'enregistre rien sans ton OK.
- **Reste** : vérifier la table d'aliments ; lecture de capture et route Tasker jamais testées en vrai ; points d’audit de l’après-midi (voir plus bas) ; banque : adresse de retour à confirmer chez Enable Banking.


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

## L'IA peut écrire dans toute l'app (16/10)
- Elle peut noter séances, nuits, pas, budgets, dépenses (migration `0008_steps` appliquée). Elle voit ce qui est déjà noté et pose une question utile après chaque ajout. 115 tests (validation des entrées en code).
- **Non testé de bout en bout** : ni la vraie IA ni la vraie base n'ont tourné en local (pas de clés). À tester sur téléphone : « aujourd'hui j'ai fait 2000 pas sans mon téléphone », « j'ai fait une séance de muscu ».
- Pas encore possible : écrire dans l'agenda (non connecté), supprimer une donnée (volontaire).

## Objectifs + import Revolut (16/10)
- Objectifs : l'IA (`set_goal`) et le formulaire de Finances créent / mettent à jour les objectifs ; Accueil et Finances affichent le vrai (dégradé par défaut). Si Finances est réel sans objectif, l'Accueil invite à en créer un (plus d'exemple Australie).
- Import : CSV ou .xlsx, format Revolut reconnu seul. 128 tests (faux relevé Revolut en CSV et en vrai .xlsx) + test navigateur réel d'un .xlsx.
- **Pas testé avec un vrai export Revolut** (inventé d'après les colonnes décrites) : si un vrai fichier échoue, m'envoyer l'en-tête et 2 lignes anonymisées.

## Session de l'après-midi (branche `aprem`) — journal
### Choix faits à ta place
- **URL de redirection banque** : tu ne me l'avais pas donnée. Constante unique `BANK_REDIRECT_URL` dans `src/lib/bank-config.ts`, valeur par défaut `https://majordome-bice.vercel.app/api/bank/callback` (NON confirmée). Elle doit être identique, au caractère près, à celle d'Enable Banking, sinon la banque refuse.
- **Migrations à appliquer (je n'en applique aucune)** : `0009_bank_connections.sql` (sans elle, « Connecter » est masqué et affiche « pas encore activée »).
- Première synchro = 90 jours en arrière ; ensuite on repart 7 jours avant la dernière. Si tu avais importé un CSV de la même période, des doublons sont possibles (les libellés banque et CSV diffèrent).
- Retour de la banque : protégé par un « state » signé de 10 min (la banque ne peut pas envoyer le code d'accès). Messages d'erreur de l'API affichés bruts.
### Tâche 1 — banque : faite (routes connecter / retour / synchro, carte Banque, vrai solde sur Accueil et Finances, alerte à 14 jours). Testée avec de faux appels, jamais avec la vraie banque.
### Tâche 2 — annuler / supprimer : faite. Bouton « Annuler » 10 s sous la réponse de l'IA (tâche, souvenir, objectif, opération, budget, séance, nuit, pas) ; suppression (avec confirmation) depuis Planning, Finances (opérations, objectifs) et Forme (séances, nuit, pas). Seules les tables autorisées (src/lib/undo.ts) sont touchables.
### Tâche 3 — mémoire fiable : faite. Cause trouvée dans tes messages : l'IA répondait « j'ai noté ton objectif » SANS appeler d'outil (rien d'écrit). Corrigé par 3 filets (ordres explicites exécutés par le code, consignes durcies, alerte automatique en cas de faux « c'est noté »). Testé avec un faux modèle + les vraies phrases.
### Tâche 4 — Revolut : faite. L'import lit aussi le fichier en français (Date de fin, Montant, Frais, Devise, État « TERMINÉ », Solde), répare les en-têtes mal encodés (« Ã‰tat »), accepte le signe « − » et les dates JJ/MM/AAAA. Solde = celui de l'opération terminée la plus récente (jamais d'une ligne en attente / annulée / en livres). Testé avec de faux fichiers CSV et .xlsx, jamais de vraies données. **Migration `0010_balance_snapshots.sql` à appliquer** pour CONSERVER ce solde (sans elle : affiché dans le message d'import seulement).
### Tâche 5 — coût de l'IA : fait. Carte « Coût de l'IA » en bas du profil (aujourd'hui, ce mois, par modèle), calculée en code à l'heure de Paris. Constat : tes 33 appels passés sont en gpt-4o-mini à 0 $ (prix jamais renseigné) ; j'ai ajouté son tarif public (0,15 / 0,60 $ par million, à vérifier) pour les appels À VENIR ; les anciens restent à 0 (signalé sur la carte).
### Tâche 6 — audit : fait. 5 corrections, chacune avec test : (1) l'import ne perd plus d'opérations quand un libellé contient une virgule/guillemet (lecture par dates) ; (2) le chat refuse les messages mal formés ou énormes (400) ; (3) en-têtes de sécurité sur toutes les routes ; (4) tâches : titre/notes bornés, échéance stricte avec fuseau (« 1 » ou « demain » refusés, l'IA reçoit l'erreur et corrige) ; (5) souvenirs bornés à 500 caractères.
**Reste à faire (par gravité)** : moyen — le code d'accès n'a pas de limite d'essais ; moyen — une opération bancaire supprimée peut revenir à la synchro (il faudrait une « pierre tombale », migration) ; faible — l'Accueil ignore une réponse 401 ; faible — petites fonctions fetch dupliquées ; faible — message `?bank=` affiché tel quel ; pas fait — recherche de code mort.

## RÉSUMÉ DE L'APRÈS-MIDI (pour Ruben)
- **Fait** : 1 banque (connexion, synchro, solde réel) · 2 bouton Annuler + suppression · 3 mémoire fiable · 4 Revolut en français + solde · 5 carte coût IA · 6 audit, 5 corrections testées. Tâche 7 (finitions) : non faite, plus rien d'urgent.
- **À FAIRE PAR TOI** : appliquer dans Supabase les migrations `0009_bank_connections.sql` et `0010_balance_snapshots.sql` (rien n'a été appliqué).
- **À vérifier** : l'adresse de retour de la banque `https://majordome-bice.vercel.app/api/bank/callback` (fichier `src/lib/bank-config.ts`) doit être exactement celle déclarée chez Enable Banking — je l'ai supposée.
- **Test sur téléphone** : connecter la banque puis « Actualiser » ; demander à l'IA d'ajouter une tâche et appuyer sur « Annuler » ; dire « retiens que… » puis regarder l'onglet Mémoire ; importer un vrai export Revolut ; ouvrir le profil → coût de l'IA.
- **Choix à ta place** : voir « Choix faits à ta place » plus haut. Aucune variable Vercel ni clé touchée.
- **Reste** : liste de l'audit ci-dessus.

## Session du soir (branche `soir`) — journal
### Migrations à appliquer (rien n'est appliqué)
- `0009_bank_connections.sql`, `0010_balance_snapshots.sql` (voir plus haut) et **`0011_nutrition_screen.sql`** (tables `food_logs`, `nutrition_goals`, `screen_time_logs`). Sans la 0011 : Forme n'affiche pas les cartes Repas / Écran, et l'IA répond « migration manquante ».
### Tâche 1 — tout est pilotable à la voix : fait. Donnée → outils de l'IA
| Donnée | Créer / modifier | Supprimer |
|---|---|---|
| Tâches | `add_task`, `update_task`, `complete_task` | `delete_entry` (task) |
| Souvenirs | `remember`, `update_memory` | `forget` |
| Objectifs d'épargne | `set_goal`, `add_to_goal` | `delete_entry` (goal) |
| Budgets | `set_budget` | `delete_entry` (budget) |
| Opérations | `add_transaction`, `update_transaction` | `delete_entry` (transaction) |
| Séances | `log_workout`, `update_workout` | `delete_entry` (workout) |
| Sommeil / Pas | `log_sleep`, `log_steps` (remplacent) | `delete_entry` (sleep / steps) |
| Repas | `log_food` | `delete_entry` (food) |
| Objectif nutrition | `set_nutrition_goals` | — (une seule ligne, se modifie) |
| Temps d'écran | `log_screen_time` | `delete_entry` (screen_time) |
| Réglage « lecture à voix haute » | `set_setting` | — |
- Non pilotables, volontairement : code d'accès et « Nouvelle conversation » (propres au navigateur), connexion bancaire (consentement de ta banque), import d'un fichier. Toute suppression par l'IA : seulement sur demande claire, avec bouton Annuler.
### Tâche 2 — épargne : faite. `add_to_goal` (nom souple, question si ambigu), carte « Épargne par mois » (Engagé / Libre / Mis de côté) et une phrase par objectif daté. 11 tests.
### Tâche 3 — nutrition : faite. `log_food` + table de ~250 aliments (source Ciqual, valeurs à vérifier, voir decisions.md), objectif calorique/macros à la voix, carte « Aujourd'hui » dans Forme, repas « estimé » marqués. 16 tests.
### Tâche 4 — temps d'écran : fait. Voix, bouton, capture lue par l'IA avec confirmation, route `POST /api/screen-time` pour Tasker (`docs/temps-ecran.md`), tendance 7 j vs 7 j. 9 tests.
### Tâche 6 — sécurité : faite. 5 mauvais codes depuis la même IP → 10 min d'attente (en mémoire, voir decisions.md). Pendant l'attente le bon code est aussi refusé (message « Code d'accès incorrect »). 6 tests.
### Tâche 5 — Planning : fait. Vue jour par défaut (frise 7–22 h, heures vides regroupées, ligne « maintenant »), tâches sans heure en haut, semaine en mini-points (lun → dim), glisser à gauche/droite ou flèches pour changer de jour, fiche de tâche (modifier, terminer, reporter, supprimer avec confirmation), zones tactiles ≥ 44 px. `PATCH /api/tasks` accepte maintenant titre / échéance / priorité / notes (mêmes validations). Rendu vérifié en 390×844 (captures). 12 tests.

## Journal du soir
- **Tâche planifiée « Majordome-soir » : NON créée.** Mon enregistrement (`Register-ScheduledTask`, qui lance `claude --dangerously-skip-permissions` toutes les 45 min) a été REFUSÉ par le garde-fou de Claude Code (« Create Unsafe Agents »). Je ne le contourne pas. Pour l'activer toi-même : `powershell -ExecutionPolicy Bypass -File scripts\soir-tache.ps1` (puis `Get-ScheduledTask -TaskName Majordome-soir`). Scripts prêts : `scripts/soir-run.ps1`, `scripts/soir-tache.ps1`.
- **Veille du PC (powercfg, lecture seule)** : sur secteur, mise en veille après inactivité = jamais (0) et hibernation = jamais (0). Rien modifié.
- Cette session (non planifiée) exécute `docs/soir.md` à la main, sur la branche `weekend`.
- T1 Miroir réel — gain : fort (le bilan devient vrai) / coût : moyen. En cours.
- T1 FAIT : « Ta semaine » = vraies données (tâches, dépenses vs semaine d'avant, sport, sommeil, kcal) calculées en code ; 2-3 phrases de l'IA (haiku, cachées 6 h), jetées si elles citent un chiffre absent des faits. Temps d'écran : pas de donnée réelle, donc absent. Route GET /api/week.
- T2 Briefing du jour — gain : fort (comprendre sa journée en 5 s) / coût : petit. En cours.
- T2 FAIT : briefing de l'Accueil (3 lignes en code : prochain agenda, tâches, Libre ou budget dépassé) à la place de l'ancienne phrase.
- T3 Tâches récurrentes — gain : fort (zéro oubli) / coût : gros. En cours. Migration 0012 écrite, non appliquée.
- T3 FAIT : tâches récurrentes à la voix (« tous les lundis », « chaque jour », « tous les mois le 5 », heure facultative = agenda). Compris et calculé en code (src/lib/recurrence.ts) ; créées au chargement des tâches ; supprimables à la voix. **Migration 0012_recurring_tasks.sql à appliquer** (sans elle : aucune récurrence, aucune erreur).
- T4 FAIT : raccourcis Android (Parler / Ajouter une tâche / Ajouter une dépense : ouvrent le chat prêt à écrire) + partage d'un relevé CSV/XLSX vers l'app (le service worker garde le fichier, l'app lance l'import). **Non testé sur Android** : il faut réinstaller / rouvrir la PWA pour que le téléphone relise le manifest.
- T5 Nutrition (compléter Ciqual : 123 aliments gardent encore des valeurs approchées) — gain : moyen / coût : moyen. En cours.
- T5 FAIT : 166 aliments sur 261 maintenant lus dans le fichier officiel Ciqual (95 gardent des valeurs approchées) ; test sur 3 valeurs déjà en place.
- T6 Robustesse hors ligne — gain : fort (13 h, réseau faible) / coût : moyen. En cours.
- T6 FAIT : hors ligne — un message du chat jamais perdu (revient dans le champ, repart tout seul au retour du réseau), ajouts de tâches mis en file et rejoués, erreurs réseau / IA / serveur en français simple. Vérifié par simulation Playwright (réseau coupé puis rétabli). Pas de mode hors-ligne complet (pas de cache des écrans).
- **Revue produit (après T1-T6)** — frictions : (1) à 23 h, l'Accueil ne montre pas « ce qui m'attend demain » ; (2) cartes Solde / Ta forme encore fictives tant que les tables ne sont pas remplies, mélange réel / aperçu déroutant ; (3) hors ligne, les écrans Finances / Forme restent vides (pas de cache). Corrections qui valent le coup : ligne « Demain » dans le briefing ; carte Forme réelle (kcal du jour).
- T7 FAIT : coût IA — historique envoyé 20 → 12 messages, vieilles réponses de Majordome coupées à 400 caractères (demandes de Ruben jamais coupées, alerte « faux enregistrement » gardée). **Mesure sur 5 messages d'une longue conversation (estimation 1 token ≈ 4 caractères) : 21 810 → 15 745 tokens envoyés, −28 %.** Le contexte (mémoire, tâches, vie) n'a pas été réduit : il pèse peu et sert à l'IA.
- T8 Dette technique — gain : moyen (fiabilité) / coût : moyen. En cours.
- T8 FAIT : la fonction « sans accents » n'existait déjà plus qu'en UNE copie (src/lib/text.ts) ; les appels fetch répétés passent par UN helper (src/app/api-client.ts, 6 fichiers) ; code d'accès déjà comparé en temps constant (sha256 + timingSafeEqual) ; code mort supprimé (groupOf, dayLabel, nextDays, GROUPS, weeklyPrompt). Gardés volontairement car préparés pour la suite : screenTrend / minutesLabel (temps d'écran), isAppointmentMail / isWorkoutTitle (Google).
- T9 Accessibilité / performance — gain : moyen / coût : petit à moyen. En cours.
- T9 FAIT : JS du premier chargement 784 → 608 Ko (−22 %, non compressé) : onglets, profil, bilan de semaine et rendu markdown chargés à la demande ; anneau de focus accent visible au clavier ; sorties du mouvement déjà respectées (prefers-reduced-motion). Aucun nouveau saut de mise en page constaté sur les captures.
- T10 FAIT : tests de bout en bout Playwright des 5 parcours (parler → tâche → annuler ; cocher ; repas ; dépense ; changer de jour) : `npm run dev` puis `npm run e2e` (scripts/e2e.mjs, API simulée, 5/5 passent).
- T11 Guide rappels — gain : moyen / coût : petit. En cours.
- T11 FAIT : docs/rappels-setup.md réécrit en 5 étapes (≈10 min) : clés → Vercel → Vault → migration 0007 → téléphone. À faire par toi quand tu veux (je ne touche pas aux variables Vercel).
- T12 Idées (notées avant de coder) : (1) **briefing du soir** : après 18 h, la 1re ligne de l'Accueil devient « Demain : N éléments d'agenda, le premier à HH:MM » (réponse à la friction « 23 h : qu'est-ce qui m'attend demain ? ») — gain moyen / coût petit ; (2) **carte « Ta forme » réelle** : nuit, séances de la semaine et kcal du jour à la place des chiffres fictifs dès que les données existent — gain moyen / coût petit. Pas de 3e idée : gain faible.

## À décider par Ruben
- Mode hors ligne complet (cache des écrans Finances / Forme) : utile en métro, mais plus lourd (service worker avec cache) — à faire seulement si tu perds souvent le réseau.
- Rattrapage des récurrences manquées (si tu n'ouvres pas l'app un lundi) : aujourd'hui rien n'est rattrapé.
- Gain faible, laissé de côté : réduire le contexte (mémoire, tâches) envoyé à l'IA ; temps d'écran réel (attend une source de données, Tasker).
- La tâche planifiée « Majordome-soir » n'a pas pu être créée par moi (garde-fou) : à lancer toi-même si tu veux des runs automatiques.
- T12 FAIT : briefing du soir (annonce demain après 18 h) + carte « Ta forme » avec les kcal du jour. Liste terminée : arrêt intelligent (rien à désactiver, la tâche planifiée n'existe pas).
- Bloc A FAIT (mascotte). Bloc B en cours : réveils / minuteurs.
- Bloc B FAIT : outils `set_alarm` / `set_timer` (calcul de l'heure en code) → carte dans le chat avec bouton « Créer le réveil » / « Lancer le minuteur » qui ouvre l'Horloge Android (lien intent: dans un vrai lien, tap requis) ; en vocal, le chat ne se referme pas tant que la carte n'est pas touchée ou fermée. **À TESTER SUR TÉLÉPHONE** : on ne sait pas si l'app installée (PWA) laisse passer les liens intent:.
- Bloc C en cours : pg_cron (récurrences chaque jour à 4 h Paris, rappels chaque minute). Migrations écrites, PAS appliquées.
- Bloc C FAIT (code) : route `POST /api/cron/recurring` (secret + 4 h Paris), rappels chaque minute (0007 modifiée : `* * * * *`), migration `0013_cron_recurring.sql` écrite. **NON APPLIQUÉES : 0007, 0012, 0013 attendent ton OK** (contenu affiché dans ma réponse). Pas de tâche planifiée Windows, pas de Vercel Cron.
