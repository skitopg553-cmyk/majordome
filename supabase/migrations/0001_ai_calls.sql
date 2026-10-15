-- Journal de chaque appel à l'API Claude : permet de suivre le coût réel de Majordome.
create table if not exists public.ai_calls (
  id            bigint generated always as identity primary key,
  created_at    timestamptz not null default now(),
  model         text        not null,
  purpose       text        not null,          -- "chat", "briefing", "tri-mail"...
  input_tokens  integer     not null,
  output_tokens integer     not null,
  cost_usd      numeric(10, 6) not null,
  duration_ms   integer
);

-- Sécurité : on active RLS sans aucune règle → personne ne peut lire/écrire
-- depuis le navigateur. Seul le serveur (clé service_role) y a accès.
alter table public.ai_calls enable row level security;

-- Vue pratique : dépense par jour.
create or replace view public.ai_costs_daily
with (security_invoker = true) as
select
  date_trunc('day', created_at)::date as day,
  count(*)                            as calls,
  sum(cost_usd)                       as cost_usd
from public.ai_calls
group by 1
order by 1 desc;
