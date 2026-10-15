-- Phase 4 : finances. ÉCRITE PENDANT LA NUIT, NON APPLIQUÉE : à valider par Ruben.
-- Ajouts uniquement (aucune suppression). RLS activé sans règle : seul le serveur (clé secrète) lit et écrit.
-- Tant que ces tables n'existent pas, l'app affiche l'aperçu fictif de l'onglet Finances.

-- Opérations importées depuis les relevés CSV.
create table if not exists public.transactions (
  id          bigint generated always as identity primary key,
  created_at  timestamptz   not null default now(),
  date        date          not null,
  label       text          not null,
  amount      numeric(12,2) not null,           -- négatif = dépense
  category    text          not null default 'Autre',
  -- Empêche les doublons quand on réimporte le même relevé :
  -- date|libellé|montant|n° d'occurrence (deux cafés identiques le même jour restent deux opérations).
  import_key  text          not null unique
);
alter table public.transactions enable row level security;
create index if not exists transactions_date_idx on public.transactions (date desc);

-- Budget mensuel par catégorie.
create table if not exists public.budgets (
  id            bigint generated always as identity primary key,
  category      text          not null unique,
  monthly_limit numeric(12,2) not null check (monthly_limit > 0)
);
alter table public.budgets enable row level security;

-- Objectifs d'épargne (avec image de fond pour la carte).
create table if not exists public.savings_goals (
  id          bigint generated always as identity primary key,
  created_at  timestamptz   not null default now(),
  label       text          not null,
  target      numeric(12,2) not null check (target > 0),
  saved       numeric(12,2) not null default 0,
  due_label   text,                                -- ex. « Avril » (texte libre)
  image_url   text
);
alter table public.savings_goals enable row level security;
