-- Carte du matin « Comment avez-vous dormi ? » : heure de coucher, heure de lever et qualité de la nuit, gardées avec la durée déjà notée.
-- AJOUT uniquement (colonnes nullables) : les nuits déjà notées ne changent pas. Sans cette migration, la durée seule est enregistrée.
alter table public.sleep_logs
  add column if not exists bed_time  text     check (bed_time  ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  add column if not exists wake_time text     check (wake_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  add column if not exists quality   smallint check (quality between 1 and 3); -- 1 = mal, 2 = moyen, 3 = bien
