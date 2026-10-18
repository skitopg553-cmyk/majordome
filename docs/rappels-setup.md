# Activer les rappels en 10 minutes (5 étapes)

Les rappels préviennent **5 minutes avant** chaque élément d'agenda (une tâche avec une heure précise) : Supabase vérifie **chaque minute**. Les tâches sans heure ne notifient pas. Le même secret sert à une 2e tâche automatique : **chaque jour à 4 h (Paris)**, les tâches récurrentes (« tous les lundis »…) sont créées même si tu n'ouvres pas l'app. Tant que ces étapes ne sont pas faites, la ligne « Rappels » du profil affiche « Bientôt disponible » et rien ne casse.

> ⚠️ La clé **privée** et le `CRON_SECRET` sont des secrets : seulement dans Vercel et le Vault Supabase, jamais dans un chat ni dans git.

## 1. Fabriquer les clés (2 min)
Dans un terminal, dans le dossier du projet, deux commandes :
```bash
npx web-push generate-vapid-keys
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```
La première donne une **Public Key** et une **Private Key**. La seconde donne le **CRON_SECRET** (une longue phrase au hasard). Garde les trois sous la main.

## 2. Les mettre dans Vercel (3 min)
Vercel → `majordome` → **Settings → Environment Variables** (Production), 4 variables :

| Nom | Valeur |
|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | la Public Key |
| `VAPID_PRIVATE_KEY` | la Private Key |
| `VAPID_SUBJECT` | `mailto:` + ton e-mail |
| `CRON_SECRET` | le CRON_SECRET |

Puis **Deployments → Redeploy** (obligatoire : la clé publique est intégrée à la construction de l'app).

## 3. Donner le CRON_SECRET à Supabase (1 min)
Supabase → `majordome` → **SQL Editor**, en remplaçant la valeur par le même CRON_SECRET :
```sql
select vault.create_secret('LE_CRON_SECRET', 'cron_secret');
```

## 4. Appliquer les migrations (2 min)
Supabase → SQL Editor, dans cet ordre (colle le contenu de chaque fichier, puis exécute) :
1. `supabase/migrations/0012_recurring_tasks.sql` : la table des tâches récurrentes (si pas déjà fait) ;
2. `supabase/migrations/0007_push.sql` : abonnements aux notifications, colonne `reminded_at`, et le job **chaque minute** qui envoie les rappels ;
3. `supabase/migrations/0013_cron_recurring.sql` : le job **chaque jour à 4 h (Paris)** qui crée les tâches récurrentes.

Vérifier : `select jobname, schedule from cron.job;` doit montrer `majordome-rappels` (`* * * * *`) et `majordome-recurrentes` (`5 2,3 * * *`, c'est-à-dire 2 h et 3 h UTC : une seule des deux tombe à 4 h à Paris, l'autre ne fait rien).
Tester la création des récurrentes tout de suite (sans attendre 4 h), depuis un terminal (remplace SECRET) :
```bash
curl -X POST https://majordome-bice.vercel.app/api/cron/recurring -H "x-cron-secret: SECRET" -H "Content-Type: application/json" -d '{"force":true}'
```
Réponse attendue : `{"created":N}`.

## 5. Activer sur le téléphone et tester (3 min)
1. Installe l'app (menu Chrome → « Ajouter à l'écran d'accueil ») : sur Android, les notifications marchent mieux depuis l'app installée.
2. Ouvre l'app → avatar **R** → **Rappels** → **Activer** → accepte les notifications.
3. Test : dis à Majordome « rendez-vous test dans 8 minutes » (une heure précise est nécessaire). La notification arrive environ 5 minutes avant.

## Couper les rappels
- Couper les rappels : SQL Editor → `select cron.unschedule('majordome-rappels');` (et `'majordome-recurrentes'` pour les récurrences)
- Sur un téléphone : réglages Android → Applications → Chrome (ou majordome.) → Notifications.

## Ça ne marche pas ?
| Symptôme | Piste |
|---|---|
| « Bientôt disponible » | `NEXT_PUBLIC_VAPID_PUBLIC_KEY` absente, ou pas de Redeploy après l'avoir ajoutée (étape 2). |
| « Les rappels ne sont pas encore installés » | Migration 0007 pas appliquée (étape 4). |
| Rien n'arrive | `select * from net._http_response order by created desc limit 5;` : 401 = le CRON_SECRET n'est pas le même dans Vercel et dans le Vault ; 404 = variables manquantes dans Vercel. |
| Rien n'arrive pour une tâche | Elle n'a pas d'heure précise : c'est une tâche, pas un rendez-vous. |
