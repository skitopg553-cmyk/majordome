# Majordome — instructions projet

Assistant personnel IA (secrétaire, coach, conseiller). Utilisateur unique : Ruben. Usage perso d'abord, vente éventuelle plus tard.

## Contexte développeur
- Ruben est débutant en dev (bases React, TypeScript, Supabase, Vercel).
- Explique brièvement chaque choix technique non évident, en français.
- Avance par petites étapes testables. Pas de gros refactors non demandés.

## Stack (figée, voir docs/decisions.md)
- PWA : Next.js (App Router) + TypeScript + Tailwind, déployée sur Vercel
- Supabase : Postgres, Auth, tâches planifiées
- IA : API Claude — `claude-haiku-5-5` pour le tri/catégorisation, `claude-sonnet-5-5` pour le raisonnement
- Calculs, règles et dates : code classique, jamais le LLM

## Règles
- Suivre `docs/roadmap.md` : une seule phase à la fois, ne pas anticiper les phases suivantes.
- Un seul agent avec des outils (tool use). Pas de multi-agents tant que ce n'est pas décidé dans `docs/decisions.md`.
- Accès Gmail / Calendar / banque : **lecture seule**. Aucune action irréversible sans confirmation explicite de l'utilisateur.
- Chaque appel IA est journalisé (modèle, tokens, coût estimé) dans la table `ai_calls`.
- Secrets uniquement dans les variables d'environnement, jamais dans le code ni dans git.
- Toute décision d'architecture nouvelle → l'ajouter à `docs/decisions.md`.
- Fin de phase → cocher dans `docs/roadmap.md` et noter ce qui a été appris.
