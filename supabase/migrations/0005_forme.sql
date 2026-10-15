-- Phase 5 : forme. ÉCRITE PENDANT LA NUIT, NON APPLIQUÉE : à valider par Ruben.
-- Ajouts uniquement. RLS activé sans règle : seul le serveur (clé secrète) lit et écrit.
-- Tant que ces tables n'existent pas, l'onglet Forme affiche l'aperçu fictif.

-- Sommeil saisi à la main : une ligne par nuit (date = jour du réveil).
create table if not exists public.sleep_logs (
  id         bigint generated always as identity primary key,
  created_at timestamptz  not null default now(),
  date       date         not null unique,
  hours      numeric(4,2) not null check (hours > 0 and hours <= 16)
);
alter table public.sleep_logs enable row level security;

-- Séances de sport (saisie manuelle, puis détectées dans l'agenda en phase 2).
create table if not exists public.workouts (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  date       date        not null,
  kind       text        not null,
  minutes    integer     check (minutes is null or (minutes > 0 and minutes <= 600)),
  source     text        not null default 'manuel' check (source in ('manuel', 'agenda'))
);
alter table public.workouts enable row level security;
create index if not exists workouts_date_idx on public.workouts (date desc);
