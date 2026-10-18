# État de Majordome — 18/10/2026 (session « voix + Android + audit », branche `voix-android` fusionnée dans `main`)

> Fichier réécrit (pas allongé). Détails : `git log`, `docs/decisions.md`, `docs/audit.md`. Tests : 593 verts, build vert.

## Ce qui marche
- **Accueil** (briefing en code, tâches, mascotte), **Planning** (agenda = éléments avec heure), **Finances** (import, budgets, épargne, banque : 1 connexion enregistrée), **Forme**, **Ta semaine**, **chat + voix** (tout se pilote à la voix, bouton Annuler), **hors ligne** (message gardé), **récurrences** (créées à l'ouverture de l'app tant que 0013 n'est pas appliquée).
- **Réveils / minuteurs — bug corrigé (18/10)** : cause = (1) l'IA recopiait « Touche le bouton pour le créer » **sans toujours appeler l'outil** (je lui avais donné cette phrase dans ses consignes), donc pas de carte, et (2) rien ne vérifiait la promesse. Maintenant : le **code reconnaît la phrase** (« mets un réveil à 7h demain », « minuteur de 5 minutes »…), prépare la carte et écrit lui-même la phrase, **sans appel IA** ; si l'IA répond quand même « bouton » sans carte, un avertissement est ajouté. Sur le web, la carte (bouton) reste le repli.
- **Voix naturelle — étape 1 faite** : page `/voix-test` (4 voix OpenAI + téléphone, délai mesuré, coût estimé), route `/api/tts` (protégée, plafond, repli, journal `ai_calls`), nettoyage du texte lu (balises, markdown, emojis, heures et nombres en toutes lettres), le tout testé. **Rien n'est branché dans l'app : j'attends ton choix à l'oreille.**
- **Coque Android (Capacitor)** : dossier `android/` (appId `fr.majordome.app`, charge le site Vercel, navigation limitée à notre domaine, APK debug seulement), plugin **`AlarmPlugin`** (réveil/minuteur sans tap, `EXTRA_SKIP_UI`, vérification `resolveActivity`, permission SET_ALARM, `<queries>` pour Android 11+), confirmation vocale générée par le code (« Ok, réveil réglé à sept heures. »), ligne **« Test réveil dans 2 minutes »** dans Réglages (visible seulement dans la coque). **Non compilé** : Android Studio n'est pas installé sur ce PC (ni Java).
- **Audit produit** : `docs/audit.md` (aucun code modifié).

## Migrations : 0001-0005 et 0008-0012 DÉJÀ appliquées. Il reste 3 migrations (j'attends ton OK), dans cet ordre : `0006_google.sql`, `0007_push.sql`, `0013_cron_recurring.sql`.
Le code marche sans elles (la fonction concernée reste simplement éteinte).

## Étapes manuelles qui restent (une par une)
1. **Voix** : ouvre `https://majordome-bice.vercel.app/voix-test` sur ton téléphone (code d'accès déjà saisi dans l'app), joue les 3 phrases avec chaque voix, note celle que tu préfères et le délai affiché. Dis-moi laquelle (pour tester Gemini ou ElevenLabs : crée la clé comme indiqué sur la page, ajoute la variable dans Vercel, ne me la colle jamais).
2. **Android** : suis `docs/android-setup.md` (installer Android Studio, ouvrir `android/android`, Build APK, installer sur le téléphone, **Réglages → Test réveil dans 2 minutes**). Dis-moi le résultat avant d'aller plus loin.
3. **Rappels** : `docs/rappels-setup.md` (clés VAPID, 4 variables Vercel, secret dans le Vault, 0007, 0013).
4. **Google** : `docs/google-setup.md` (puis 0006).
5. **Variable facultative** : `VOICE_MAX_CHARS_PER_DAY` (défaut 8 000 caractères ≈ 0,13 $/jour). Rien d'autre pour la voix OpenAI : elle utilise déjà `OPENAI_API_KEY`.

## À tester sur téléphone (jamais vérifié en vrai)
**Réveil sans tap (coque Android)** · phrases de réveil/minuteur dites (carte + texte cohérents, y compris « demain ») · voix cloud (`/voix-test`) · raccourcis et partage de relevé · mascotte · récurrences · hors ligne · glissement du Planning.

## Mesures et limites (honnêtes)
- **Délai de la voix cloud : non mesuré** (je n'appelle pas OpenAI sans toi) : la page l'affiche. Attendu : ~0,8-1,5 s pour une phrase courte ; le découpage phrase par phrase (à brancher après ton choix) vise un premier son < 1 s.
- **Coût voix (estimé, tarif à re-vérifier)** : ≈ 0,0025 $ pour 10 s de parole ; plafond 8 000 caractères/jour ≈ 0,13 $ ; usage moyen 3 000 caractères/jour ≈ 1,5 $/mois.
- **Coût IA réel** : 0,0088 $ au total (49 appels) ; prompt fixe de ~5 100 tokens par appel (voir audit §3).
- Temps de réponse du chat côté Vercel (`[timing]`) : toujours non mesuré (le connecteur Vercel ne voit aucun projet).
- Imparfait : l'historique garde la phrase « web » d'un réveil (pas la confirmation de la coque) ; plugin en **Java** (pas Kotlin, voir decisions.md) ; la coque ouvre les connexions Google/banque dans Chrome (à faire une seule fois).

## Décisions à prendre (Ruben)
1. Quelle voix ? (après écoute) · 2. Le test du réveil marche-t-il ? (sinon plan B Tasker + ntfy, décrit dans `docs/android-setup.md`) · 3. Modèle par défaut : petit modèle + Sonnet en renfort (recommandé) ou Sonnet partout · 4. Quelles priorités de l'audit (§6) on construit, dans quel ordre · 5. Réglage « Ton » (Doux / Direct / Coach, audit §7) : on le fait ?
