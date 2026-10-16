-- Connexion bancaire (Enable Banking, lecture seule). ÉCRITE, NON APPLIQUÉE : à valider par Ruben avant d'être appliquée.
-- Ajout uniquement. Les opérations vont dans la table `transactions` existante ; cette table garde seulement l'accord de lecture.

create table if not exists public.bank_connections (
  id             bigint generated always as identity primary key,
  created_at     timestamptz not null default now(),
  provider       text        not null default 'enable_banking',
  bank_name      text        not null,                 -- ex. « Revolut »
  session_id     text        not null unique,          -- session Enable Banking (inutilisable sans notre clé privée)
  -- Comptes de la session : [{ uid, name, currency, balance, balance_at }]. Pas d'IBAN complet : on n'en a pas besoin.
  accounts       jsonb       not null default '[]'::jsonb,
  valid_until    timestamptz,                          -- fin du consentement (PSD2 : 90 jours max) → avertissement dans l'app
  last_synced_at timestamptz
);

-- Accès serveur uniquement : RLS activé SANS aucune règle (comme les autres tables), et en plus on retire les droits
-- aux rôles publics de l'API (anon / authenticated) : même si une règle était ajoutée par erreur un jour, ces données restent fermées.
alter table public.bank_connections enable row level security;
revoke all on public.bank_connections from anon, authenticated;
