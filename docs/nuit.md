# Session de nuit — Majordome

Tu travailles SEUL, sans Ruben. Personne ne répondra à tes questions : tu décides, tu notes, tu avances.

## Au début de chaque run
1. Si le fichier .nuit.lock existe et a moins de 3 h : arrête-toi immédiatement. Sinon crée-le (tu le supprimeras en fin de run).
2. git checkout nuit && git pull.
3. Lis CLAUDE.md, docs/etat.md (surtout le « Journal de nuit »), docs/roadmap.md, docs/decisions.md, docs/architecture.md et design/stitch/ (référence visuelle). Reprends exactement là où le run précédent s'est arrêté.

## La vision (ne jamais la perdre)
- On ne vend pas une IA, on vend une vie en ordre : moins de charge mentale, moins d'oublis, plus d'argent de côté, plus de sport. Chaque écran doit servir ça.
- Parler à Majordome est le cœur de l'app : le point lumineux central (bouton vocal) EST le personnage.
- Très peu d'onglets : Accueil | Planning | [point vocal] | Finances | Forme. Mémoire et réglages derrière l'avatar.
- Ultra simple : quelqu'un de très peu à l'aise avec la tech comprend chaque écran en 5 secondes. Textes en français simple, comme un ami organisé. Aucun chiffre inventé présenté comme réel.
- Identité : fond #050506, surfaces #111215, UNE seule couleur d'accent #6CF2FF, police Poppins, « majordome. » avec un point final lumineux. Inspiration néobanque (Revolut), sobriété Apple.
- Majordome ne fait rien d'irréversible sans validation : il propose, Ruben valide d'un tap.

## Règles absolues
- Travaille UNIQUEMENT sur la branche nuit. Jamais de push sur main, jamais de merge.
- Base de données : n'applique AUCUNE migration. Écris-les dans supabase/migrations/ (ajouts uniquement : CREATE TABLE / ADD COLUMN, jamais DROP, DELETE, ni modification destructive). Le code doit fonctionner proprement si la table n'existe pas encore (afficher l'aperçu fictif).
- Pendant tes tests, ne crée en base que des tâches dont le titre commence par "[TEST NUIT]", et supprime uniquement celles-là à la fin.
- Ne touche pas à .env.local, aux variables Vercel ni aux secrets. Ne les affiche jamais dans les logs.
- Ne modifie pas docs/nuit.md.
- npm run build doit passer avant chaque commit. Si une tâche bloque plus de 20 min : note-la et passe à la suivante.
- Aucune décision produit nouvelle hors de cette liste : en cas de doute, choisis l'option la plus simple et note la question pour Ruben.

## Boucle pour chaque tâche
1. Prends la prochaine tâche non faite de la liste ci-dessous.
2. Implémente le minimum complet (pas de code « pour plus tard »).
3. Vérifie :
   - npm run build ;
   - tests unitaires (vitest) pour toute logique pure : calculs, dates, parsing, règles ;
   - npm run dev puis un script Playwright qui capture chaque écran touché en 390×844 (dossier captures/, ignoré par git). REGARDE les captures toi-même.
4. Auto-critique visuelle avec cette grille : alignements et espacements réguliers, contraste du texte suffisant, aucun texte coupé ou qui déborde, zones tactiles ≥ 44 px, une seule couleur d'accent, animations courtes et douces (150–300 ms), rien qui saute au chargement, états vides et de chargement soignés. Corrige puis refais la capture (2 tours max).
5. Commit (message en français) + push sur nuit. Ajoute une ligne au Journal de nuit dans docs/etat.md.

## Revue produit (toutes les 3 tâches)
Mets-toi à la place de Ruben, 21 ans, alternant en BTS, freelance, très occupé, qui utilise l'app sur Android :
- 7 h 30 : il ouvre l'app en se levant. Comprend-il sa journée en 5 secondes ?
- 13 h : il a 30 secondes entre deux clients pour noter un truc à la voix. Est-ce que ça marche du premier coup ?
- 22 h : il fait le point sur sa journée et son argent. Est-ce rassurant, ou est-ce que ça culpabilise ?
Écris tes constats dans docs/revue-produit.md. Corrige tout de suite ce qui est petit et cohérent avec docs/decisions.md. Le reste devient des questions pour Ruben.

## Tâches, dans l'ordre
A. Finir le travail en cours (voir docs/etat.md) : vitesse, historique du chat, refonte design d'après design/stitch/ + identité ci-dessus, navigation avec le point vocal, coquilles des sections, onglet Mémoire, PWA.
B. Voix (phase 3) : le point central fonctionne. Dictée Web Speech en fr-FR, envoi automatique, réponse lue à voix haute (speechSynthesis, voix française), états visuels du point (repos, écoute, réflexion, parle), repli clavier si non supporté, réglage pour couper la voix. Teste la logique d'états en unitaire.
C. Planning : une timeline par jour (tâches réelles + RDV fictifs), une vue semaine, l'ajout rapide sans IA, « reporter à demain » en un geste.
D. Finances (phase 4), sans base appliquée :
   - import CSV bancaire (séparateur ; ou ,, virgule décimale française, dates JJ/MM/AAAA) ;
   - catégorisation par règles dans un fichier modifiable, avec appel Haiku prévu pour les cas ambigus ;
   - dépenses du mois et budgets par catégorie ;
   - « dépense inhabituelle » = plus de 2× la médiane de sa catégorie sur 90 jours ;
   - objectifs d'épargne avec image et barre de progression.
   Migration écrite, UI sur données fictives tant que la table n'existe pas, tests unitaires solides sur le parsing et les calculs.
E. Forme (phase 5) : détection des séances de sport dans les titres d'événements (mots-clés), saisie manuelle du sommeil et des séances, régularité de la semaine. Tests.
F. Préparer la phase 2 (mails + agenda) SANS l'activer :
   - pré-filtre des mails en code (mots-clés de RDV en français, expéditeurs), testé sur 20 exemples fictifs ;
   - code de connexion Google derrière un interrupteur désactivé ;
   - guide pas à pas docs/google-setup.md pour que Ruben crée le client OAuth.
G. Préparer les rappels (fin de phase 1) :
   - service worker, abonnement push, route d'envoi ;
   - migration push_subscriptions + pg_cron écrite mais NON appliquée ;
   - docs/rappels-setup.md : comment générer les clés et quelles variables ajouter dans Vercel.
H. Préparer le miroir (phase 6) : fonction qui résume la semaine (tâches faites/en retard, dépenses, séances), prompt du bilan hebdomadaire, écran « Ta semaine » en aperçu, testé avec des données fictives.
I. Finitions : états vides, squelettes de chargement, micro-animations, accessibilité, poids de l'app. Termine par /ponytail-audit et corrige les points importants.

## Fin de chaque run (ou dès que tu sens la limite approcher)
Mets à jour docs/etat.md :
- Journal de nuit : ce qui est fait ;
- ce qui bloque ;
- questions pour Ruben, numérotées ;
- migrations à valider ;
- variables d'environnement à ajouter ;
- lien de l'aperçu Vercel de la branche nuit.
Puis commit + push sur nuit, et supprime .nuit.lock.
