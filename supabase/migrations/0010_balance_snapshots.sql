-- Solde lu dans un relevé importé (colonne « Balance » / « Solde » d'un export Revolut). ÉCRITE, NON APPLIQUÉE : c'est Ruben qui l'applique.
-- Ajout uniquement. Sans cette table, l'import marche quand même ; le solde est seulement affiché dans le message d'import, pas conservé.
create table if not exists public.balance_snapshots (
  id         bigint generated always as identity primary key,
  created_at timestamptz   not null default now(),
  source     text          not null default 'import',   -- d'où vient le solde (import d'un relevé)
  balance    numeric(12,2) not null,
  as_of      date          not null                      -- jour de l'opération la plus récente du relevé
);
create index if not exists balance_snapshots_as_of_idx on public.balance_snapshots (as_of desc, created_at desc);

-- Accès serveur uniquement : RLS sans règle + droits retirés aux rôles publics (donnée bancaire).
alter table public.balance_snapshots enable row level security;
revoke all on public.balance_snapshots from anon, authenticated;
