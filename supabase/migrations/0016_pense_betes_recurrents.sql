-- Pense-bêtes qui reviennent (sans heure) : « fait aujourd'hui » et « X fois par semaine ». AJOUTS uniquement (colonne nullable, nouvelle table) : rien n'est supprimé ni modifié.
-- Sans cette migration, l'app marche comme avant (une tâche créée par jour à partir de la règle).

-- « Passer l'aspirateur 2 fois par semaine » : nombre de fois par semaine (null = règle à jours fixes).
alter table public.recurring_tasks add column if not exists per_week smallint check (per_week between 1 and 7);

-- Un « fait » par règle et par jour (le pense-bête est calculé à l'affichage, il n'est plus copié dans tasks chaque jour).
create table if not exists public.recurring_checks (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  rule_id    bigint not null references public.recurring_tasks (id) on delete cascade, -- supprimer la règle efface ses « faits »
  day        date   not null,
  unique (rule_id, day)
);
alter table public.recurring_checks enable row level security; -- aucune règle : seul le serveur (clé secrète) lit et écrit
