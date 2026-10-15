-- Phase 2 : connexion Google (lecture seule). ÉCRITE PENDANT LA NUIT, NON APPLIQUÉE : à valider par Ruben.
-- Ajouts uniquement. RLS activé sans règle : seul le serveur (clé secrète) lit et écrit.
-- Le refresh token permet de LIRE Gmail et l'Agenda en arrière-plan ; il ne quitte jamais le serveur.
create table if not exists public.google_tokens (
  id            bigint generated always as identity primary key,
  created_at    timestamptz not null default now(),
  refresh_token text        not null,
  scope         text        not null
);
alter table public.google_tokens enable row level security;
