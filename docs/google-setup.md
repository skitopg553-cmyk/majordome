# Connecter Google (Gmail + Agenda, lecture seule) — guide pas à pas

But : que Majordome puisse **lire** tes mails et ton agenda pour repérer les rendez-vous. Il ne pourra **rien envoyer, rien modifier, rien supprimer** : on ne demande que les autorisations « lecture seule ».

Durée : ~15 minutes. Tout est gratuit.

> ⚠️ Ne colle jamais l'ID client secret dans un chat ni dans le code : il va uniquement dans les variables Vercel.

## 1. Créer un projet Google Cloud
1. Va sur https://console.cloud.google.com et connecte-toi avec le compte Google que Majordome doit lire.
2. En haut à gauche, clique sur le sélecteur de projet → **Nouveau projet**.
3. Nom : `majordome` → **Créer**. Vérifie qu'il est bien sélectionné en haut.

## 2. Activer les deux API
1. Menu ☰ → **API et services** → **Bibliothèque**.
2. Cherche **Gmail API** → **Activer**.
3. Reviens à la Bibliothèque, cherche **Google Calendar API** → **Activer**.

## 3. Écran de consentement
1. Menu ☰ → **API et services** → **Écran de consentement OAuth** (ou « Google Auth Platform » → **Branding**).
2. Type d'utilisateur : **Externe** → Créer.
3. Nom de l'application : `Majordome`, e-mail d'assistance : ton adresse. Enregistrer.
4. Partie **Accès aux données / Champs d'application** → **Ajouter** :
   - `.../auth/gmail.readonly`
   - `.../auth/calendar.readonly`
   - `openid` et `email`
   (Rien d'autre. Si Google propose `gmail.modify` ou `gmail.send` : **non**.)
5. Partie **Audience / Utilisateurs test** → **Ajouter des utilisateurs** → ton adresse Gmail.
   L'app reste en mode « Test » : c'est normal pour un usage perso, pas besoin de validation Google.

## 4. Créer l'ID client OAuth
1. **API et services** → **Identifiants** → **Créer des identifiants** → **ID client OAuth**.
2. Type d'application : **Application Web**. Nom : `Majordome Vercel`.
3. **URI de redirection autorisés** → Ajouter :
   `https://majordome-bice.vercel.app/api/google/callback`
4. **Créer**. Google affiche l'**ID client** et le **Code secret du client** : garde la fenêtre ouverte pour l'étape 5.

## 5. Ajouter les variables dans Vercel
Vercel → projet `majordome` → **Settings** → **Environment Variables** → ajoute (environnement **Production**) :

| Nom | Valeur |
|---|---|
| `GOOGLE_CLIENT_ID` | l'ID client de l'étape 4 |
| `GOOGLE_CLIENT_SECRET` | le code secret de l'étape 4 |
| `GOOGLE_REDIRECT_URI` | `https://majordome-bice.vercel.app/api/google/callback` |
| `GOOGLE_ENABLED` | `true` — **seulement quand tu veux activer** (c'est l'interrupteur) |

Puis **Deployments** → dernier déploiement → **Redeploy** (toute nouvelle variable exige un redeploy).

## 6. Créer la table et se connecter
1. Valide et applique la migration `supabase/migrations/0006_google.sql` (table `google_tokens`).
2. La connexion se lance avec `POST /api/google/connect` : l'écran de l'app pour le faire viendra avec la phase 2. Google te montre les autorisations : tu dois voir uniquement « Afficher vos e-mails » et « Afficher vos agendas ».
3. Au retour, l'app s'ouvre avec `?google=ok`.

## Couper l'accès à tout moment
- Dans Vercel : supprime `GOOGLE_ENABLED` (ou mets `false`) + Redeploy → plus aucune lecture.
- Côté Google : https://myaccount.google.com/permissions → Majordome → **Supprimer l'accès**.

## En cas de problème
| Message au retour | Cause probable |
|---|---|
| `?google=refuse` | Tu as cliqué « Annuler » chez Google. |
| `?google=lien-expire` | Plus de 10 min entre le clic et le retour : relance. |
| `?google=sans-acces-hors-ligne` | Google n'a pas renvoyé de refresh token : supprime l'accès (lien ci-dessus) et reconnecte. |
| `?google=table-manquante` | Migration 0006 pas appliquée. |
| `redirect_uri_mismatch` (page Google) | L'URI de l'étape 4 et `GOOGLE_REDIRECT_URI` ne sont pas strictement identiques. |
