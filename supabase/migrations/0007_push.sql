-- Rappels push (fin de phase 1). ÉCRITE PENDANT LA NUIT, NON APPLIQUÉE : à valider par Ruben.
-- Ajouts uniquement. Avant d'appliquer : suivre docs/rappels-setup.md (clés VAPID, CRON_SECRET dans Vercel ET dans le Vault Supabase).

-- Téléphones abonnés aux notifications.
create table if not exists public.push_subscriptions (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  endpoint   text        not null unique,
  p256dh     text        not null,
  auth       text        not null
);
alter table public.push_subscriptions enable row level security;

-- Une tâche n'est rappelée qu'une fois.
alter table public.tasks add column if not exists reminded_at timestamptz;

-- Chaque minute, Supabase appelle la route d'envoi de Vercel.
-- Le secret n'est PAS écrit ici : il est lu dans le Vault Supabase (secret nommé « cron_secret », voir le guide).
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'majordome-rappels',
  '* * * * *',
  $$
  select net.http_post(
    url     := 'https://majordome-bice.vercel.app/api/push/send',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body    := '{}'::jsonb
  );
  $$
);
