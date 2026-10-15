-- Historique du chat : chaque message (Ruben ou Majordome) est conservé.
-- RLS activé sans règle : seul le serveur (clé secrète) lit et écrit.

create table if not exists public.messages (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  role       text        not null check (role in ('user', 'assistant')),
  content    text        not null
);
alter table public.messages enable row level security;

-- On relit toujours les plus récents : index sur la date.
create index if not exists messages_created_at_idx on public.messages (created_at desc);
