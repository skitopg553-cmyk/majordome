# Roadmap Majordome

Règle d'or : une phase à la fois. Une phase est finie quand Ruben **utilise vraiment** ce qu'elle livre.

## Phase 0 — Fondations (≈1 semaine)
- [x] Projet Next.js + TypeScript + Tailwind, installable en PWA
- [x] Projet Supabase créé (`majordome`, Paris) + migration `0001_ai_calls.sql` appliquée
- [x] Déploiement Vercel relié au dépôt GitHub (majordome-bice.vercel.app)
- [x] Clé API IA : démarrage sur OpenAI `gpt-4o-mini` (crédits restants), bascule Claude plus tard
- [x] Page de chat qui répond, protégée par un code d'accès
- [x] Table `ai_calls` : chaque appel journalisé (premier appel enregistré le 2026-10-15)

✅ **Phase 0 terminée le 2026-10-15.**

Appris :
- Les noms de modèles OpenAI sont sensibles à la casse (`gpt-4o-mini`, pas `GPT-4o-mini`).
- Toute modification de variable Vercel exige un **Redeploy**.
- `SUPABASE_SERVICE_ROLE_KEY` doit être la clé *secrète* du bon projet (sinon erreur 401 silencieuse).
- Afficher la vraie cause des erreurs a fait gagner beaucoup de temps.

Étapes manuelles : voir `docs/setup.md`.

**Terminé quand** : Ruben discute avec Majordome depuis son téléphone.

## Phase 1 — Noyau tâches + mémoire (≈2 semaines)
- [x] Tables `tasks`, `memories` (objectifs = mémoires catégorie `objectif`)
- [x] Outils de l'agent : créer / modifier / terminer une tâche, mémoriser / oublier
- [x] Mémoire + tâches en cours injectées à chaque message
- [x] Vue « Tâches » dans l'app (liste à cocher) — devenue le Planning (jour / semaine, ajout rapide, « Demain »), validée sur téléphone le 2026-10-16
- [ ] Rappels par notifications push PWA — code prêt (`docs/rappels-setup.md`), reste à activer

**Terminé quand** : toutes les tâches de Ruben y passent pendant 2 semaines. → Décide si le projet continue.

## Phase 2 — Secrétaire (≈2-3 semaines)
Code terminé le 2026-10-18 (agenda dans Planning, mails → rendez-vous proposés, briefing), **désactivé** tant que Ruben n'a pas fait les étapes de `docs/google-setup.md` et appliqué la migration `0006`. Rien n'est coché tant qu'il ne s'en sert pas.
- [ ] OAuth Google, Gmail + Calendar en lecture seule
- [ ] Briefing matinal planifié (7 h) : RDV, tâches prioritaires, mails importants
- [ ] Bilan du soir

**Terminé quand** : le briefing est lu chaque matin parce qu'il est utile.

## Phase 3 — Voix (≈1-2 semaines)
- [x] Dictée (Web Speech API) + réponse vocale — faite en avance (voir decisions.md), Whisper non utilisé
- [x] Raccourcis Android (appui long sur l'icône : Parler, Ajouter une tâche, Ajouter une dépense) — codés le 2026-10-16, à tester sur téléphone. Pas de widget.
- [ ] (Annexe, non bloquant) mot d'activation : Porcupine ou Tasker

## Phase 4 — Finances (≈2 semaines)
- [x] Import CSV bancaire (+ Excel, format Revolut français)
- [x] Catégorisation par règles en code (Haiku pas utilisé : les règles suffisent pour l'instant)
- [x] Budgets, dépenses « plus élevées que d'habitude », objectifs d'épargne, capacité d'épargne (Engagé / Libre / Mis de côté)
- Connexion bancaire automatique (agrégateur DSP2) : plus tard seulement si le CSV devient pénible

## Phase 4b — Connexion bancaire (Enable Banking, lecture seule)
Remplace l'import CSV quand il devient pénible (voir « Banque via import CSV » ci-dessus : le CSV reste en secours).
- [x] Client serveur Enable Banking (JWT RS256 signé avec la clé de l'app) — fait, testé avec de faux appels
- [x] Conversion des opérations vers le même format que l'import CSV, mêmes catégories — fait, testé
- [ ] Table `bank_connections` (migration `0009` écrite, **pas encore appliquée**)
- [ ] Routes : connecter (Revolut), callback, synchro — codées et testées avec de faux appels, jamais avec la vraie banque
- [ ] Écran Finances : « Connecter ma banque », « Actualiser », vrai solde, avertissement avant l'expiration du consentement
- Contraintes : **lecture seule stricte** (jamais de paiement), **mode restreint** Enable Banking (seulement les comptes de Ruben), aucun secret dans le code ni les logs, les erreurs de l'API sont affichées telles quelles.
**Terminé quand** : le solde et les opérations Revolut s'affichent dans l'app après un tap sur « Actualiser ».

## Phase 5 — Sport & sommeil (≈2 semaines)
- [ ] Séances détectées dans l'agenda et classées en sport (code prêt, attend la connexion Google)
- [ ] Données montre via l'API de la marque ou export
- Note : Health Connect n'est accessible qu'en app native → phase 7

## Phase 6 — Le miroir (continu)
- [x] Bilan hebdo croisant les domaines (argent, sommeil, sport, tâches, repas) : écran « Ta semaine », chiffres en code + 2-3 phrases de l'IA vérifiées
- [ ] Initiatives proactives autorisées

## Phase 7 — App native Android (optionnel)
Seulement si la PWA bloque : Health Connect, temps d'écran, écoute en arrière-plan. Expo / React Native sur le même backend.

## Point de décision : vendre ?
Après 3-6 mois d'usage quotidien, avec les vrais coûts API mesurés.
