# État de Majordome — 19/10/2026 (session « ménage », branche `menage`)

> Fichier réécrit (pas allongé). Détails : `git log`, `docs/decisions.md`, `docs/audit.md`. Tests : 593 verts, build vert, 5 parcours e2e verts.

## Ce qui marche
- **Plus aucune donnée fictive** : Accueil, Planning, Finances, Forme n'affichent que du réel. Sans données : invitation honnête (« Ton solde apparaîtra ici », « Pas encore d'objectif ») ; base illisible : « indisponible + Réessayer ». Le faux « À valider » (Léa, EDF) est supprimé.
- **Écran de chargement** : mascotte + nom, seulement le temps du chargement des tâches (fondu 200 ms, garde-fou 4 s).
- **Planning** : un rendez-vous Google s'ouvre en fiche (titre, date, heures, lieu, « Ouvrir dans Google Agenda »). **Impossible de le supprimer depuis majordome** (Google en lecture seule, voulu). Tes propres éléments s'ouvrent dans la fiche tâche (modifier, terminer, reporter, supprimer). Un jour vide se glisse maintenant aussi (zone de glissement agrandie).
- **Temps d'écran réel** (code écrit, **non compilé ni testé**) : plugin Android `Usage` + carte dans Forme avec bouton « Autoriser l'accès » ; envoi à `/api/screen-time`. Sur le web : message honnête.
- Déjà là : briefing en code, tâches, Finances (import, budgets, épargne, banque), Forme, Ta semaine, chat + voix (annuler), hors ligne, récurrences, réveils/minuteurs reconnus par le code, `/voix-test` + `/api/tts` (non branché), coque Android avec plugin réveil.

## Migrations : 0001-0005 et 0008-0012 DÉJÀ appliquées. Il reste `0006_google.sql`, `0007_push.sql`, `0013_cron_recurring.sql` (j'attends ton OK).

## Étapes manuelles (une par une)
1. **Reconstruire l'APK** (`docs/android-setup.md`, étapes 4 et 6) : sans ça, le temps d'écran réel et le plugin réveil ne sont pas sur ton téléphone. Si la compilation échoue : copie-moi l'erreur.
2. Dans l'appli Android : **Forme → Temps d'écran → Autoriser l'accès** → active majordome dans la liste.
3. Voix : écoute `/voix-test` et dis-moi ta préférée. · Rappels : `docs/rappels-setup.md`. · Google : `docs/google-setup.md`.

## À tester sur téléphone (jamais vérifié en vrai)
Chargement (court, sans clignotement) · accueil sans exemple · fiche d'un rendez-vous Google (si connecté) · temps d'écran réel · réveil sans tap · phrases de réveil · voix cloud · récurrences · hors ligne.

## Limites honnêtes
- Temps d'écran : somme de toutes les applis au premier plan (lanceur compris) : peut dépasser « Bien-être numérique » ; jour = fuseau du téléphone.
- Les rendez-vous Google ne se suppriment pas d'ici. Tant que Google n'est pas connecté, le Planning ne montre que tes éléments avec heure.
- Coût IA réel : 0,0088 $ au total (49 appels) ; prompt fixe ~5 100 tokens/appel (audit §3). Voix cloud : délai non mesuré.

## Décisions à prendre (Ruben)
Quelle voix · le test du réveil marche-t-il (sinon plan B Tasker + ntfy) · modèle par défaut (petit + Sonnet en renfort, recommandé) · priorités de l'audit (§6) · réglage « Ton » (audit §7).
