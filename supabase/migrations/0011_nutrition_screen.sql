-- Nutrition + temps d'écran. NON APPLIQUÉE : à valider par Ruben. Ajouts uniquement.
-- RLS activé sans règle : seul le serveur (clé secrète) lit et écrit.

-- Ce que Ruben a mangé (saisi à la voix). Les kcal et macros sont CALCULÉES EN CODE (table Ciqual locale) ou, à défaut, estimées par l'IA.
create table if not exists public.food_logs (
  id         bigint generated always as identity primary key,
  created_at timestamptz   not null default now(),
  date       date          not null,
  label      text          not null,
  grams      numeric(8,1)  not null check (grams > 0 and grams <= 5000),
  kcal       numeric(8,1)  not null check (kcal >= 0),
  protein    numeric(7,1)  not null default 0,
  carbs      numeric(7,1)  not null default 0,
  fat        numeric(7,1)  not null default 0,
  estimated  integer       not null default 0 check (estimated in (0, 1)) -- 1 = estimé par l'IA, aliment absent de la table
);
alter table public.food_logs enable row level security;
create index if not exists food_logs_date_idx on public.food_logs (date desc);

-- Objectif du jour (une seule ligne, id = 1) : calories et macros en grammes.
create table if not exists public.nutrition_goals (
  id      bigint primary key default 1 check (id = 1),
  kcal    integer check (kcal is null or (kcal >= 800 and kcal <= 6000)),
  protein integer check (protein is null or (protein >= 0 and protein <= 500)),
  carbs   integer check (carbs is null or (carbs >= 0 and carbs <= 1000)),
  fat     integer check (fat is null or (fat >= 0 and fat <= 500))
);
alter table public.nutrition_goals enable row level security;

-- Temps d'écran : une ligne par jour, en minutes (voix, capture d'écran confirmée, ou Tasker via POST /api/screen-time).
create table if not exists public.screen_time_logs (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  date       date        not null unique,
  minutes    integer     not null check (minutes >= 0 and minutes <= 1440)
);
alter table public.screen_time_logs enable row level security;
