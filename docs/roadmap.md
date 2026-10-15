# Roadmap Majordome

Règle d'or : une phase à la fois. Une phase est finie quand Ruben **utilise vraiment** ce qu'elle livre.

## Phase 0 — Fondations (≈1 semaine)
- [ ] Projet Next.js + TypeScript + Tailwind, installable en PWA
- [ ] Projet Supabase + connexion (Auth par e-mail)
- [ ] Déploiement Vercel relié au dépôt GitHub
- [ ] Clé API Claude avec plafond de dépense
- [ ] Page de chat qui répond via Claude (Sonnet 5.5)
- [ ] Table `ai_calls` : chaque appel journalisé avec son coût

**Terminé quand** : Ruben discute avec Majordome depuis son téléphone.

## Phase 1 — Noyau tâches + mémoire (≈2 semaines)
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
