-- Créneaux, récurrences affichées à la volée et bilan des habitudes. NON APPLIQUÉE : à valider par Ruben. AJOUT uniquement, rien n'est supprimé ni modifié.
-- RLS activé sans règle partout : seul le serveur (clé secrète) lit et écrit. Sans cette migration, l'app marche comme avant.
--
-- 1) Un créneau ponctuel peut avoir une heure de FIN (le début reste due_at).
alter table public.tasks add column if not exists end_at timestamptz;

-- 2) Un créneau qui revient : plusieurs jours par règle (« 1,2,3,4,5 » = lundi à vendredi), heure de fin, et « habitude à confirmer » (salle, sport…).
--    On réutilise recurring_tasks : une règle AVEC heure (at_time) n'est plus copiée dans tasks, elle est calculée à l'affichage.
alter table public.recurring_tasks
  add column if not exists days     text check (days ~ '^[1-7](,[1-7]){0,6}$'),
  add column if not exists end_time text check (end_time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  add column if not exists habit    smallint not null default 0 check (habit in (0, 1)); -- 1 = habitude à confirmer

-- 3) Supprimer ou déplacer UNE occurrence sans casser la série.
create table if not exists public.recurring_exceptions (
  id        bigint generated always as identity primary key,
  rule_id   bigint not null references public.recurring_tasks (id) on delete cascade, -- supprimer la série efface ses exceptions
  day       date   not null,                                                         -- le jour d'origine de l'occurrence
  action    text   not null check (action in ('skip', 'move')),
  new_day   date,
  new_start text check (new_start ~ '^[0-2][0-9]:[0-5][0-9]$'),
  new_end   text check (new_end ~ '^[0-2][0-9]:[0-5][0-9]$'),
  unique (rule_id, day)
);
alter table public.recurring_exceptions enable row level security;

-- 4) Journal des habitudes : une ligne par occurrence confirmée (done = j'y suis allé, missed = pas cette fois).
create table if not exists public.habit_logs (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  rule_id    bigint not null references public.recurring_tasks (id) on delete cascade,
  day        date   not null,
  status     text   not null check (status in ('done', 'missed')),
  unique (rule_id, day) -- une seule question, une seule réponse par occurrence
);
alter table public.habit_logs enable row level security;
