-- Tâches récurrentes créées côté serveur, chaque jour à 4 h (heure de Paris), même si Ruben n'ouvre pas l'app. NON APPLIQUÉE : à valider par Ruben.
-- Ajout uniquement. À appliquer APRÈS 0012_recurring_tasks (la table des règles) et après avoir mis le secret dans le Vault (voir docs/rappels-setup.md, étape 3) :
-- la même clé « cron_secret » sert aux rappels et à cette tâche.
--
-- Pourquoi deux heures (2 h et 3 h) : pg_cron compte en UTC. 4 h à Paris = 2 h UTC l'été, 3 h UTC l'hiver. Le job tourne aux deux, et la route
-- (src/app/api/cron/recurring) ne fait quelque chose que si c'est bien 4 h à Paris. De toute façon, une règle ne crée qu'une tâche par jour.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'majordome-recurrentes',
  '5 2,3 * * *',
  $$
  select net.http_post(
    url     := 'https://majordome-bice.vercel.app/api/cron/recurring',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body    := '{}'::jsonb
  );
  $$
);
