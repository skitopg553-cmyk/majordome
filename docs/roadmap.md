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
- [ ] Connexion Supabase Auth (remplace le code d'accès de la phase 0)
- [ ] Tables `tasks`, `memories`, `goals`
- [ ] Outils de l'agent : créer / lister / prioriser / terminer une tâche
- [ ] Mémoire persistante relue à chaque conversation
- [ ] Rappels par notifications push PWA

**Terminé quand** : toutes les tâches de Ruben y passent pendant 2 semaines. → Décide si le projet continue.

## Phase 2 — Secrétaire (≈2-3 semaines)
- [ ] OAuth Google, Gmail + Calendar en lecture seule
- [ ] Briefing matinal planifié (7 h) : RDV, tâches prioritaires, mails importants
- [ ] Bilan du soir

**Terminé quand** : le briefing est lu chaque matin parce qu'il est utile.

## Phase 3 — Voix (≈1-2 semaines)
- [ ] Dictée (Web Speech API ou Whisper) + réponse vocale
- [ ] Raccourci / widget Android
- [ ] (Annexe, non bloquant) mot d'activation : Porcupine ou Tasker

## Phase 4 — Finances (≈2 semaines)
- [ ] Import CSV bancaire
- [ ] Catégorisation (règles code + Haiku pour les cas ambigus)
- [ ] Budgets, alertes dépenses inhabituelles, objectifs d'épargne
- Connexion bancaire automatique (agrégateur DSP2) : plus tard seulement si le CSV devient pénible

## Phase 5 — Sport & sommeil (≈2 semaines)
- [ ] Séances détectées dans l'agenda et classées en sport
- [ ] Données montre via l'API de la marque ou export
- Note : Health Connect n'est accessible qu'en app native → phase 7

## Phase 6 — Le miroir (continu)
- [ ] Bilan hebdo croisant les domaines (argent, sommeil, sport, tâches)
- [ ] Initiatives proactives autorisées

## Phase 7 — App native Android (optionnel)
Seulement si la PWA bloque : Health Connect, temps d'écran, écoute en arrière-plan. Expo / React Native sur le même backend.

## Point de décision : vendre ?
Après 3-6 mois d'usage quotidien, avec les vrais coûts API mesurés.
