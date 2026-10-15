-- Phase 1 : tâches et mémoire. Les objectifs sont des mémoires de catégorie 'objectif'.
-- RLS activé sans règle : seul le serveur (clé secrète) lit et écrit.

create table if not exists public.tasks (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  title      text        not null,
  notes      text,
  due_at     timestamptz,
  priority   smallint    not null default 2 check (priority between 1 and 3), -- 1 haute, 2 normale, 3 basse
  status     text        not null default 'todo' check (status in ('todo', 'done')),
  done_at    timestamptz
);
alter table public.tasks enable row level security;

create table if not exists public.memories (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  content    text not null,
  category   text not null default 'info' check (category in ('objectif', 'preference', 'habitude', 'info'))
);
alter table public.memories enable row level security;
