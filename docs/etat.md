# État de Majordome — 19/10/2026 (session « planning-habitudes »)

> Fichier réécrit (pas allongé). Détails : `git log`, `docs/decisions.md`, `docs/qa.md`, `docs/nettoyage.md`. Tests : 641 verts, build vert, 5 parcours e2e verts, parcours QA 390×844 et 360×800 sans défaut bloquant.

## Ce qui marche (dans le code, sur la branche fusionnée)
- **Trois sortes d'éléments** : pense-bête (sans heure, se coche, jamais dans le Planning), créneau (ponctuel avec début/fin, ou qui revient par jours de la semaine), habitude (créneau qui revient, « à confirmer »). Outil IA `add_slot` + consignes ; le CODE valide jours et heures, refuse les doublons, écrit le récapitulatif exact (lu à voix haute, bouton Annuler).
- **Planning** : les créneaux qui reviennent sont calculés à l'affichage (semaines futures visibles tout de suite). Toucher une occurrence : supprimer cette fois, déplacer cette fois, supprimer toute la série (avec confirmation). Le briefing de l'Accueil en tient compte.
- **Bilan des habitudes** : « Tu y es allé ? Oui / Non / Plus tard » sur l'Accueil (2 au plus, 48 h max, une fois par occurrence). Oui = célébration CSS/SVG ≈ 1,5 s (anneau cyan, particules, vibration, mascotte contente ; sobre avec « réduire les animations »). Non = message doux + Demain / Cette semaine / Laisser tomber. Pas de compteur d'échecs.
- **Évaluation** : `npm run eval:ia` (36 phrases, vrai modèle, coûte quelques centimes) ; `npm run qa` (captures + contrôles).
- Déjà là : plus aucune donnée fictive, écran de chargement, fiche des rendez-vous Google (lecture seule), temps d'écran réel (code Android non compilé), voix `/voix-test`, etc.

## ⚠️ Rien de tout cela n'est actif en production tant que la migration 0014 n'est pas appliquée
Le code marche sans elle, mais sans les colonnes : pas de jours multiples, pas de fin, pas d'habitudes, pas d'exceptions. Les 44 anciennes règles du 19/10 (en double) s'affichent aussi comme des créneaux d'une seule heure tant que le nettoyage n'est pas fait.

## Migrations en attente (j'attends ton OK, dans cet ordre)
1. **`0014_creneaux_habitudes.sql`** (nouvelle, ajouts seulement). 2. Nettoyage de ta semaine (`docs/nettoyage.md`, après 0014, à valider ligne par ligne). 3. `0006_google.sql`, `0007_push.sql`, `0013_cron_recurring.sql` (0013 ne sert plus qu'aux pense-bêtes qui reviennent SANS heure). Déjà appliquées : 0001-0005, 0008-0012.
**Garde-fou 0013 (doublons du cron 2 h 05 / 3 h 05 UTC)** : `src/lib/recurring-store.ts` ligne 29 : `update({ last_generated: today }) … .or("last_generated.is.null,last_generated.lt.<aujourd'hui>")` (une règle est « réclamée » avant de créer la tâche : le 2ᵉ passage ne trouve rien) + `isRecurringHour` (`cron-auth.ts` : ne fait quelque chose que s'il est 4 h à Paris). Testé : `more-tools.test.ts`, « deux appels le même jour… ».

## Étapes manuelles (une par une)
1. Relis `supabase/migrations/0014_creneaux_habitudes.sql`, dis-moi OK : je l'applique.
2. Relis `docs/nettoyage.md` (hypothèses : salle mer/jeu 12 h-13 h 30, boxe finit 20 h), corrige, dis OK : j'applique le nettoyage.
3. Dans `.env.local`, mets ta clé IA (jamais dans le chat), puis `npm run eval:ia` : tu me donnes le score et les phrases ratées, on ajuste les consignes.
4. Reste en attente : voix (`/voix-test`), APK Android (`docs/android-setup.md`), rappels (`docs/rappels-setup.md`), Google (`docs/google-setup.md`).

## À tester sur téléphone (jamais vérifié en vrai)
Décrire ta semaine d'un coup (récap lu à voix haute) · Planning d'une semaine future · supprimer / déplacer une occurrence · « Tu y es allé ? » Oui (ressenti de la célébration, vibration) et Non · « réduire les animations » · temps d'écran réel, réveil sans tap (Android).

## Limites honnêtes
- L'IA (gpt-4o-mini) n'a jamais été mesurée sur ces phrases : le score de `eval:ia` est la vraie réponse.
- Pas de vue « mois » dans l'appli : les récurrences se voient par semaine/jour.
- Défauts non corrigés de docs/qa.md : habitude quotidienne en double (aujourd'hui + hier), formulaire du Planning toujours déplié, durée des créneaux non visualisée.
- Hors périmètre non touché : coque Android, Finances, Forme.

## Décisions à prendre (Ruben)
OK 0014 · OK nettoyage · défauts 5 et 6 de qa.md · voix · modèle par défaut · priorités de l'audit.
