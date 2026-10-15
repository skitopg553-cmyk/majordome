# Décisions d'architecture

Format : date — décision — pourquoi.

- 2026-10-15 — **PWA Next.js d'abord, pas d'app native.** Ruben connaît React/TS/Supabase/Vercel ; une PWA s'installe sur Android. Le natif (Expo) viendra seulement si Health Connect, le temps d'écran ou l'écoute en arrière-plan l'exigent.
- 2026-10-15 — **Un seul agent avec des outils, pas de multi-agents.** Moins cher, plus simple à déboguer. On découpera quand un vrai goulot apparaîtra.
- 2026-10-15 — **Routage de modèles :** Haiku 5.5 (tri, catégorisation), Sonnet 5.5 (raisonnement), code classique (calculs, règles, dates).
- 2026-10-15 — **Lecture seule partout** (mails, agenda, banque) au départ.
- 2026-10-15 — **Banque via import CSV** avant toute API d'agrégation.
- 2026-10-15 — **Phase 0 protégée par un code d'accès** (variable `MAJORDOME_ACCESS_CODE`) plutôt que Supabase Auth : plus simple pour démarrer, empêche qu'un inconnu consomme les crédits API. Remplacé par Supabase Auth en phase 1.
- 2026-10-15 — **Point de passage unique `src/lib/ai.ts`** pour tous les appels Claude : garantit la journalisation des coûts dans `ai_calls`.
- 2026-10-15 — **Le dépôt est la source de vérité** entre le chat (planification) et Claude Code (construction) : roadmap et décisions vivent ici.
