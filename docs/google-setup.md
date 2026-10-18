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
   L'app reste en mode « Test » : c'est normal pour un usage perso, pas besoin de validation Google (mais la connexion expire alors tous les ~7 jours : voir plus bas).

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

## 6. Appliquer la migration (1 min)
Supabase → **SQL Editor** : colle le contenu de `supabase/migrations/0006_google.sql` et exécute. Elle crée deux tables, toutes les deux **fermées** (RLS sans règle + droits retirés à « anon » et « authenticated » : seul le serveur peut y toucher) :
- `google_tokens` : le jeton qui permet de LIRE Gmail et l'Agenda ;
- `mail_suggestions` : l'identifiant d'un mail et ce qui en a été extrait (titre, date, lieu). Jamais le contenu des mails.

## 7. Se connecter depuis l'app (1 min)
1. Ouvre l'app : sur l'Accueil, une carte **Google** apparaît avec le bouton **Connecter Google** (elle n'apparaît que si `GOOGLE_ENABLED=true` et que la migration est appliquée).
2. Touche-le : Google te montre les autorisations. Tu dois voir seulement « Afficher vos e-mails » et « Afficher vos agendas ». Si Google dit « application non validée » : **Paramètres avancés → Accéder à Majordome (non sécurisé)** (c'est ton propre projet).
3. Au retour, l'Accueil affiche « Google est connecté ». Tes vrais événements apparaissent dans **Planning**, les mails importants dans le briefing, et les rendez-vous trouvés dans tes mails sous forme de cartes **RDV trouvé dans un mail**.

## Ce que fait majordome avec Google (tout en lecture seule)
- **Agenda** : lit tes événements (Planning) et détecte tes séances de sport passées (Forme).
- **Mails** : lit les mails **non lus des 48 dernières heures**. Un filtre en code garde ceux qui parlent d'un rendez-vous ; l'IA (Haiku) n'en lit que 20 par jour au maximum ; la date est vérifiée par le code. S'il y a déjà un événement au même moment dans ton agenda, rien n'est proposé.
- **Il n'écrit jamais chez Google.** « Ajouter à Google Agenda » ouvre Google Agenda avec le formulaire déjà rempli : c'est Google qui enregistre, après ton tap.

## ⚠️ La connexion expire environ toutes les 2 semaines… ou toutes les semaines en mode « Test »
Tant que l'app Google Cloud est en mode **Test**, Google invalide le jeton au bout de **7 jours environ**. Aucun écran cassé : l'Accueil affiche alors une carte **Reconnecter Google** (un tap). Pour éviter ça : Google Auth Platform → **Audience** → **Publier l'application** (reste « non validée » : tu es le seul utilisateur, c'est possible pour un usage perso).

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
| Carte « Reconnecter Google » | Le jeton a expiré (mode Test : ~7 jours) : touche le bouton. |
| `redirect_uri_mismatch` (page Google) | L'URI de l'étape 4 et `GOOGLE_REDIRECT_URI` ne sont pas strictement identiques. |
