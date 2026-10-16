-- Pas du jour, notés à la main ou par l'IA (« j'ai fait 2 000 pas sans mon téléphone »). Ajout uniquement.
-- RLS activé sans règle : seul le serveur (clé secrète) lit et écrit.
create table if not exists public.steps_logs (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  date       date        not null unique,
  steps      integer     not null check (steps >= 0 and steps <= 100000)
);
alter table public.steps_logs enable row level security;
