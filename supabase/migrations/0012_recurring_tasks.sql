-- Tâches récurrentes (« tous les lundis », « chaque jour », « tous les mois le 5 »). NON APPLIQUÉE : à valider par Ruben. Ajout uniquement.
-- RLS activé sans règle : seul le serveur (clé secrète) lit et écrit. Sans cette table, l'app marche comme avant (aucune récurrence).
-- Une règle crée une tâche (table tasks) au premier chargement de la journée où elle tombe ; last_generated évite les doublons.
create table if not exists public.recurring_tasks (
  id             bigint generated always as identity primary key,
  created_at     timestamptz not null default now(),
  title          text        not null check (char_length(title) between 1 and 200),
  kind           text        not null check (kind in ('daily', 'weekly', 'monthly')),
  weekday        smallint    check (weekday between 1 and 7),    -- 1 = lundi … 7 = dimanche (weekly)
  month_day      smallint    check (month_day between 1 and 31), -- monthly
  at_time        text        check (at_time ~ '^[0-2][0-9]:[0-5][0-9]$'), -- facultatif : avec heure = agenda, sans = tâche
  last_generated date
);
alter table public.recurring_tasks enable row level security;
