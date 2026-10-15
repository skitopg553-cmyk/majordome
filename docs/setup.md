# Mise en route (phase 0)

À faire une seule fois, dans cet ordre.

## 1. Clé API Claude
1. platform.claude.com → **API keys** → créer une clé nommée `majordome`.
2. **Limits / Spend limits** → mettre un plafond mensuel bas (ex. 10 $) pour commencer.
3. Garder la clé pour l'étape 4 (elle ne s'affiche qu'une fois).

## 2. Supabase
1. supabase.com → **New project** `majordome`, région Europe (Paris ou Francfort).
2. **SQL Editor** → coller le contenu de `supabase/migrations/0001_ai_calls.sql` → Run.
3. **Project Settings → API** : noter `Project URL` et la clé `service_role` (secrète !).

## 3. Code d'accès
Choisir une longue phrase secrète (ex. 5-6 mots au hasard). Elle protège l'app : sans elle, personne ne peut utiliser tes crédits API.

## 4. Vercel
1. vercel.com → **Add New → Project** → importer le dépôt GitHub `majordome`.
2. Avant de déployer, dans **Environment Variables**, ajouter :
   - `ANTHROPIC_API_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `MAJORDOME_ACCESS_CODE`
3. **Deploy**.

## 5. Sur ton téléphone
1. Ouvrir l'URL Vercel dans Chrome → entrer le code d'accès → envoyer un message.
2. Menu ⋮ → **Ajouter à l'écran d'accueil** : Majordome s'ouvre comme une app.
3. Vérifier dans Supabase (**Table Editor → ai_calls**) qu'une ligne apparaît avec son coût.

Si tout ça marche → phase 0 terminée.
