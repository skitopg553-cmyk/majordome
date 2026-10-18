-- Phase 2 : connexion Google (LECTURE SEULE : Gmail + Agenda). NON APPLIQUÉE : à valider par Ruben. Ajouts uniquement.
--
-- Sécurité des jetons : le refresh token permet de LIRE Gmail et l'Agenda en arrière-plan. Il ne quitte jamais le serveur :
--  - RLS activé SANS aucune règle : personne ne peut rien lire ni écrire avec les clés « anon » ou « authenticated » ;
--  - et on retire explicitement tous les droits à ces deux rôles (ceinture et bretelles).
-- Seule la clé secrète du serveur (service role, qui contourne la RLS) y accède.
create table if not exists public.google_tokens (
  id            bigint generated always as identity primary key,
  created_at    timestamptz not null default now(),
  refresh_token text        not null,
  scope         text        not null
);
alter table public.google_tokens enable row level security;
revoke all on public.google_tokens from anon, authenticated;

-- Rendez-vous trouvés dans les mails. On NE STOCKE JAMAIS le contenu des mails : seulement l'identifiant du message (pour ne pas le relire)
-- et ce qui en a été extrait (titre, date et heure, lieu). status : new = proposé à Ruben, added = ajouté, dismissed = refusé,
-- none = lu mais aucun rendez-vous (ou déjà dans l'agenda) ; chaque ligne compte dans le plafond de 20 mails lus par Haiku et par jour.
create table if not exists public.mail_suggestions (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  message_id text        not null unique,
  status     text        not null default 'new' check (status in ('new', 'added', 'dismissed', 'none')),
  title      text,
  start_at   timestamptz,
  place      text
);
alter table public.mail_suggestions enable row level security;
revoke all on public.mail_suggestions from anon, authenticated;
create index if not exists mail_suggestions_created_idx on public.mail_suggestions (created_at desc);
