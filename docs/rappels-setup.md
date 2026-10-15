# Activer les rappels (notifications push) — guide pas à pas

Ce qui est déjà codé (branche `nuit`) :
- `public/sw.js` : affiche la notification et ouvre l'app au toucher ;
- Profil → Réglages → **Rappels** → « Activer » : demande l'accord du téléphone et enregistre l'abonnement ;
- `POST /api/push/send` : envoie les rappels des tâches dont l'heure arrive (5 min avant, ou jusqu'à 1 h après si un passage a été raté) ;
- migration `supabase/migrations/0007_push.sql` : table des abonnements, colonne `reminded_at`, tâche planifiée toutes les 5 min.

Tant que les étapes ci-dessous ne sont pas faites, la ligne « Rappels » affiche « Bientôt disponible » et la route d'envoi répond 404. Rien ne casse.

> ⚠️ La clé **privée** VAPID et le `CRON_SECRET` sont des secrets : uniquement dans Vercel / le Vault Supabase, jamais dans un chat ni dans git.

## 1. Générer les clés VAPID (une seule fois)
Dans un terminal, dans le dossier du projet :
```bash
npx web-push generate-vapid-keys
```
Il affiche une **Public Key** et une **Private Key**.

## 2. Inventer un CRON_SECRET
Une longue phrase aléatoire (≥ 32 caractères), par exemple générée par :
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

## 3. Variables Vercel
Vercel → `majordome` → **Settings** → **Environment Variables** (Production) :

| Nom | Valeur |
|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | la Public Key |
| `VAPID_PRIVATE_KEY` | la Private Key |
| `VAPID_SUBJECT` | `mailto:` + ton adresse e-mail (ex. `mailto:moi@exemple.fr`) |
| `CRON_SECRET` | la phrase de l'étape 2 |

Puis **Redeploy** (obligatoire : `NEXT_PUBLIC_…` est intégrée au moment du build).

## 4. Mettre le CRON_SECRET dans le Vault Supabase
Supabase → projet `majordome` → **SQL Editor**, puis exécute (en remplaçant la valeur) :
```sql
select vault.create_secret('LA_PHRASE_DE_L_ETAPE_2', 'cron_secret');
```
(La même valeur que dans Vercel : c'est ce qui prouve que l'appel vient bien de Supabase.)

## 5. Appliquer la migration
Applique `supabase/migrations/0007_push.sql` (après relecture). Elle active `pg_cron` et `pg_net` et programme l'appel toutes les 5 minutes.
Vérifier : SQL Editor → `select * from cron.job;` doit montrer `majordome-rappels`.

## 6. Sur le téléphone
1. Installe l'app (menu Chrome → « Ajouter à l'écran d'accueil ») : sur Android, les notifications marchent mieux depuis l'app installée.
2. Ouvre l'app → avatar **R** → Réglages → **Rappels** → **Activer** → accepte les notifications.
3. Test : crée une tâche pour dans 3 minutes. La notification arrive au plus tard 5 minutes après.

## Couper les rappels
- Tout couper : SQL Editor → `select cron.unschedule('majordome-rappels');`
- Sur un téléphone : réglages Android → Applications → Chrome (ou majordome.) → Notifications.

## En cas de problème
| Symptôme | Piste |
|---|---|
| « Bientôt disponible » | `NEXT_PUBLIC_VAPID_PUBLIC_KEY` absente, ou pas de Redeploy après l'avoir ajoutée. |
| « Les rappels ne sont pas encore installés » | Migration 0007 pas appliquée. |
| Rien n'arrive | `select * from net._http_response order by created desc limit 5;` : 401 = secrets différents entre Vercel et le Vault ; 404 = variables manquantes dans Vercel. |
