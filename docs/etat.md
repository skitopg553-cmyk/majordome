# État de Majordome — 18/10/2026 (session du lundi, tout fusionné dans `main`)

> Fichier réécrit (pas allongé). Historique détaillé : `git log` et `docs/decisions.md`. Tests : 442 verts, build vert, `npm run e2e` : 5 parcours sur 5.

## Ce qui marche
- **Accueil** : briefing de 4 lignes calculé en code (prochain agenda, tâches, mails importants si Google, Libre ou budget dépassé ; le soir : demain), widget Tâches (cocher = animation + vibration), mascotte.
- **Mascotte « majordome. »** : deux yeux blancs qui suivent le doigt, clignent, s'endorment après 60 s, réagissent à la voix et à l'humeur de l'IA (`@mood:`) ; partout où l'assistant apparaît.
- **Chat / voix** : tout se pilote à la voix (tâches, récurrences, mémoire, objectifs, budgets, dépenses, repas, séances, sommeil, pas, réglages, suppression avec bouton Annuler 10 s, réveils et minuteurs par carte). Message jamais perdu hors ligne.
- **Planning** : agenda = éléments avec heure (frise, glissement qui suit le doigt, date réelle). Tâche = sans heure (Accueil). Vrais événements Google quand connecté.
- **Finances** : import CSV / Excel (Revolut FR), budgets, capacité d'épargne, objectifs, connexion banque (code prêt, jamais testé en vrai). **Forme** : sommeil, séances, pas, repas (Ciqual : 166 aliments sur 261 officiels), temps d'écran = aperçu fictif. **Ta semaine** : chiffres réels + 2-3 phrases de l'IA vérifiées.
- **Google (Agenda + Gmail, lecture seule)** : code terminé, **désactivé** (`GOOGLE_ENABLED`). Voir `docs/google-setup.md`.
- **Serveur planifié** : récurrences à 4 h (Paris) et rappels chaque minute via Supabase pg_cron : code prêt, migrations 0007 et 0013 à appliquer.

## Migrations : 0001 à 0005, 0008, 0009, 0010, 0011 et 0012 sont DÉJÀ appliquées dans Supabase (vérifié par Ruben). Il reste 3 migrations (j'attends ton OK), dans cet ordre
1. `0006_google.sql` (Google : jetons + propositions de mails, tables fermées) · 2. `0007_push.sql` (rappels, chaque minute ; demande le secret dans le Vault, `docs/rappels-setup.md`) · 3. `0013_cron_recurring.sql` (récurrences à 4 h Paris ; le secret du Vault doit exister, comme pour 0007).
Le code marche sans elles (la fonction concernée reste simplement éteinte).

## À faire par toi (manuel)
- Rappels : `docs/rappels-setup.md` (clés VAPID, 4 variables Vercel, secret dans le Vault, migrations, test). Je ne touche jamais aux variables Vercel.
- Google : `docs/google-setup.md` (projet Google Cloud, 2 API, écran de consentement, ID client, 4 variables Vercel dont `GOOGLE_ENABLED=true`, redeploy, migration 0006, bouton « Connecter Google » sur l'Accueil).
- Banque : confirmer chez Enable Banking que l'adresse de retour est `https://majordome-bice.vercel.app/api/bank/callback` (supposée).

## À tester sur téléphone (jamais vérifié en vrai)
Réveil / minuteur (le lien `intent:` passe-t-il dans la PWA installée ?) · raccourcis par appui long sur l'icône · partage d'un relevé Revolut vers l'app · mascotte (regard, voix, humeurs, batterie) · récurrences · mode hors ligne · glissement du Planning.

## Mesures
- Temps de réponse du chat (`[timing]` de Vercel) : **non mesuré** : le connecteur Vercel de cette session ne voit aucun projet (liste vide). À faire : Vercel → ton projet → **Logs** → filtrer `[timing]`, envoyer 3 messages, noter `total=` et `premier_mot=`.
- Historique envoyé à l'IA : −28 % de tokens (estimé) ; JS de démarrage −22 %.

## Choix faits à ta place
Récurrence = tâche créée au premier chargement du jour ou par le cron de 4 h (pas de rattrapage des jours manqués) · sans heure = échéance 00:00 · mails : seul le contenu des candidats (≤ 20/jour, ≤ 2 000 caractères) part chez l'IA, rien n'est gardé · jeton Google expiré = carte « Reconnecter » · 0007 passée de « toutes les 5 min » à « chaque minute » · humeur de l'IA visible 5 s.

## À décider par Ruben
- Publier l'app Google Cloud (fin de l'expiration à 7 jours, mais écran « non validée ») ou rester en mode Test et reconnecter chaque semaine ?
- Mode hors ligne complet (cache des écrans Finances / Forme) : utile seulement si tu perds souvent le réseau.
- Rattraper les récurrences d'un jour où l'app n'a pas été ouverte ET où le cron n'a pas tourné ?
- Temps d'écran réel : attend une source (Tasker). 95 aliments gardent des valeurs approchées (pas de code Ciqual sûr).
