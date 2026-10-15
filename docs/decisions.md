# Décisions d'architecture

Format : date — décision — pourquoi.

- 2026-10-15 — **PWA Next.js d'abord, pas d'app native.** Ruben connaît React/TS/Supabase/Vercel ; une PWA s'installe sur Android. Le natif (Expo) viendra seulement si Health Connect, le temps d'écran ou l'écoute en arrière-plan l'exigent.
- 2026-10-15 — **Un seul agent avec des outils, pas de multi-agents.** Moins cher, plus simple à déboguer. On découpera quand un vrai goulot apparaîtra.
- 2026-10-15 — **Routage de modèles :** Haiku 5.5 (tri, catégorisation), Sonnet 5.5 (raisonnement), code classique (calculs, règles, dates).
- 2026-10-15 — **Lecture seule partout** (mails, agenda, banque) au départ.
- 2026-10-15 — **Banque via import CSV** avant toute API d'agrégation.
- 2026-10-15 — **Phase 0 protégée par un code d'accès** (variable `MAJORDOME_ACCESS_CODE`) plutôt que Supabase Auth : plus simple pour démarrer, empêche qu'un inconnu consomme les crédits API. Remplacé par Supabase Auth en phase 1.
- 2026-10-15 — **Point de passage unique `src/lib/ai.ts`** pour tous les appels Claude : garantit la journalisation des coûts dans `ai_calls`.
- 2026-10-15 — **Fournisseur IA interchangeable** (`AI_PROVIDER` = `openai` ou `anthropic`). Démarrage sur les crédits OpenAI restants, bascule vers Claude ensuite en changeant une variable Vercel. Le code appelle des *niveaux* (`sonnet`/`haiku`), pas des modèles précis.
- 2026-10-15 — **Pas de Supabase Auth pour l'instant** : l'app est mono-utilisateur, le code d'accès suffit. À revoir seulement si l'app est ouverte à d'autres.
- 2026-10-15 — **Pas de table `goals`** : un objectif est une mémoire de catégorie `objectif`. Une table de moins.
- 2026-10-15 — **Contexte injecté plutôt qu'outils de lecture** : mémoires et tâches en cours sont ajoutées au prompt à chaque message (code), l'agent n'a des outils que pour écrire. Moins d'allers-retours, moins cher. À revoir si les volumes grossissent.
- 2026-10-15 — **Le dépôt est la source de vérité** entre le chat (planification) et Claude Code (construction) : roadmap et décisions vivent ici.
