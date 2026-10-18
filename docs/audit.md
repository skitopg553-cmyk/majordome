# Audit produit de majordome. — 18/10/2026

> Rapport sans aucune modification de code. Preuves : fichiers, mesures de la vraie base (lecture seule, `ai_calls`, `messages`, conseillers de sécurité Supabase), mesures de build. Je suis franc : c'est fait pour que tu choisisses, pas pour te rassurer.

## Le constat en 6 lignes
1. **Le produit est en avance sur l'usage.** En 3 jours (15 → 18/10) : **25 messages** à l'IA, **1** souvenir, **12** tâches, **1** séance, **1** nuit, **1** repas, **0** récurrence, **0** budget. On a construit ~9 200 lignes de code, **22 outils IA**, 5 écrans, Google, la banque, la voix, Android… pour un usage quotidien qui n'a pas encore commencé.
2. **L'app ne vient jamais vers toi.** Rappels (0007), récurrences (0013), Google (0006) sont écrits mais **éteints**. Une app « vie en ordre » qui ne te parle que si tu l'ouvres perd contre ton propre oubli. C'est le défaut n°1, bien avant le design.
3. **Le prompt grossit sans qu'on le voie** : 740 tokens d'entrée par appel le 15/10, 2 396 le 16/10, **4 786 le 18/10** (×6,5). Cause mesurée : 1 841 tokens de consignes + **3 279 tokens de définitions des 22 outils**, envoyés à CHAQUE message.
4. **Le coût IA est ridicule aujourd'hui (0,01 $ au total) mais pas « tenable par construction »** : tout dépend du modèle choisi (voir §3).
5. **La sécurité repose sur un seul secret partagé** (le code d'accès) et sur la discipline d'appeler `denied(req)` dans chacune des 27 routes. Correct pour toi seul, **inacceptable pour vendre**.
6. **Un produit multi-utilisateur n'existe pas encore** : une seule base, aucun compte, aucune isolation par personne.

---

## 1. Santé technique

| Sujet | Mesure / preuve | Verdict |
|---|---|---|
| Taille | `src` : 9 224 lignes (hors tests) ; tests : 3 384 lignes, **593 tests**, 51 fichiers ; 27 routes API ; plus gros fichiers : `chat-view.tsx` 487, `finances-view.tsx` 482, `home-view.tsx` 347 | Sain pour l'âge du projet |
| Démarrage | JS du 1er chargement : **608 Ko** non compressé (784 avant le chargement à la demande, 16/10). Non mesuré sur un vrai téléphone | Correct ; à mesurer en réel (Lighthouse sur Android) |
| Réponse du chat | Durée des appels modèle (`ai_calls`, 47 appels) : **p50 1,2 s, p90 2,0 s, p99 3,5 s**. Un message avec outil = 2 appels ≈ 2,5-4 s + lecture du contexte en base. Le temps « premier mot » côté Vercel n'est **pas mesuré** (le connecteur Vercel ne voit aucun projet) | Acceptable, pas « instantané » ; le poids du prompt est le premier levier |
| Si l'IA tombe | Erreur lisible (« L'IA est très sollicitée »), message gardé et renvoyé au retour du réseau. **Pas de bascule automatique** vers l'autre fournisseur (`AI_PROVIDER` se change à la main dans Vercel) | Moyen |
| Si Supabase tombe | `buildContext()` lève une exception : **le chat entier échoue**, même pour « mets un réveil » (qui n'a pourtant pas besoin de la base depuis le 18/10 : c'est le seul chemin sans contexte) | À corriger : mode dégradé |
| Si le réseau tombe | Messages et ajouts de tâches mis en file ; **dépenses, repas, séances, sommeil : perdus** (pas de file) | Incomplet |
| Dette | Fonction « sans accents » : 1 copie (`text.ts`) ✅ ; helper d'appel API unique ✅ ; 3 commentaires `shortcut:` (documentés) | Bonne hygiène |
| Tests manquants | **Aucun test d'écran** (composants React) : couverts seulement par 5 parcours Playwright *avec API simulée* ; routes API : peu de tests directs (la logique est testée dans `src/lib`, pas les routes) ; **rien ne teste le vrai Supabase ni la vraie IA** | Le risque réel est ici : tout ce qui passe par la vraie base / le vrai modèle n'a jamais été vérifié automatiquement |
| Code mort / non branché | `screen-time.ts` + route + table : **tout le temps d'écran est un aperçu fictif** ; `demo-data.ts` : chiffres FICTIFS affichés sur l'Accueil (Solde, objectif « Voyage en Australie », Forme) tant que les tables sont vides — bandeau « aperçu » mais **mélange réel/faux déroutant** | À simplifier (§5) |

## 2. Sécurité (classée par gravité)

**Haute**
- **H1 — Un seul secret pour tout.** Le code d'accès est une chaîne statique, stockée en clair dans le `localStorage` du téléphone, envoyée à chaque requête. S'il fuit (XSS, téléphone prêté, capture d'écran), tout est lisible et modifiable : finances, messages, tâches, et il permet de **dépenser des crédits IA / voix**. Pas de session, pas de révocation par appareil, pas de rotation. Le verrou d'essais est **en mémoire par instance** (`rate-limit.ts`) : partiel. *Pour toi seul : acceptable. Pour vendre : bloquant.*
- **H2 — La sécurité dépend de chaque route.** La base n'a **aucune règle d'accès** (RLS activée sans politique : 16 tables, conseiller Supabase niveau INFO) et le serveur utilise la clé « service » qui contourne tout. Donc **si une nouvelle route oublie `denied(req)`, elle expose tout**. Aujourd'hui les 27 routes sont couvertes (callbacks et rappels ont leurs propres secrets signés), mais rien ne l'impose automatiquement. *Correctif : un middleware qui refuse tout `/api/*` sans code valide, sauf une liste blanche explicite + un test qui échoue si une route n'est pas listée.*

**Moyenne**
- **M1 — Ce qui part chez l'IA** : à chaque message : souvenirs, tâches, **8 dernières opérations bancaires (libellés commerçants + montants)**, budgets, objectifs, sommeil, repas du jour, séances. Les **mails candidats** (jusqu'à 2 000 caractères, ≤ 20 par jour) partiront chez le fournisseur d'IA une fois Google activé. Rien n'est gardé côté IA d'après leurs conditions API, mais **à écrire noir sur blanc dans la politique de confidentialité**.
- **M2 — Données personnelles stockées en clair** : 269 opérations bancaires (libellés), 50 messages (conversation complète, **jamais purgée**), 1 connexion bancaire (session Enable Banking), puis jetons Google (0006). Pas de chiffrement applicatif, pas de durée de conservation, pas d'export / suppression « RGPD » en un tap.
- **M3 — Pas de `Content-Security-Policy`** (seuls nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy). Un script injecté pourrait lire le `localStorage` (donc le code d'accès). `react-markdown` n'interprète pas le HTML brut : le risque est faible aujourd'hui.

**Basse**
- Clés : uniquement en variables d'environnement ✅ ; `.env.local` ignoré par git ✅ ; secrets cron comparés en temps constant ✅ ; aucune clé dans les logs ✅. `npm audit` (production) : **0 faille** ✅.
- Injection par mail : le contenu d'un mail ne sert qu'à extraire un JSON **validé en code** (date, heure) et chaque proposition demande ton tap ✅. Le chat n'a jamais accès au contenu des mails ✅.
- Coque Android : `allowNavigation` limité à notre domaine ✅ ; APK debug seulement, aucune clé de signature dans git ✅.
- Voix cloud : route protégée + plafond de 8 000 caractères/jour (≈ 0,13 $) : même avec le code volé, la perte est bornée ✅.

## 3. Coût réel (table `ai_calls`, 49 lignes)

| Jour | Appels | Entrée moy. | Coût | Durée moy. |
|---|---|---|---|---|
| 15/10 | 13 | 740 tok | 0 $ (prix non renseigné à l'époque) | 1,6 s |
| 16/10 | 31 | 2 396 tok | 0,0059 $ | 1,4 s |
| 18/10 | 5 | 4 786 tok | 0,0036 $ | 1,3 s |

Par fonction : `chat` 47 appels / 102 742 tokens d'entrée / **1 801 tokens de sortie** (le prompt coûte 57× plus que les réponses) ; `categorisation` 1 appel. **Total : 0,0088 $.**

**Projection d'un utilisateur actif** (40 messages/jour, 1,5 appel par message, 4 800 tokens d'entrée, 40 de sortie) :

| Modèle principal | Coût / appel | Par mois | Tenable à 10-15 € ? |
|---|---|---|---|
| gpt-4o-mini (actuel) | 0,0007 $ | **≈ 1,3 $** | Oui, très large marge |
| claude-haiku-5-5 | 0,0005 $ | ≈ 0,9 $ | Oui |
| **claude-sonnet-5-5** (celui des consignes du projet) | 0,0100 $ | **≈ 18 $** | **Non** tel quel |
| Sonnet + prompt réduit (outils par intention, ÷3) + cache de prompt (entrée à 10 %) | ≈ 0,0015 $ | ≈ 2,7 $ | Oui |

À ajouter par utilisateur : voix cloud **1,5 à 4 $/mois** (plafond), mails/Haiku < 0,3 $, banque (Enable Banking : gratuit en mode restreint, payant en commercial). **Infrastructure** : Vercel Hobby n'est **pas autorisé pour un usage commercial** (Pro ≈ 20 $/mois fixe) + Supabase Pro ≈ 25 $/mois : ≈ 45 $ fixes, donc **il faut ~10 abonnés pour couvrir l'infra seule**.
**Réponse :** un abonnement à 10-15 € est tenable **si** le modèle par défaut est petit (Haiku / gpt-4o-mini) avec Sonnet réservé aux cas difficiles, **si** on réduit le prompt et **si** la voix cloud garde son plafond. Avec Sonnet partout : non.

## 4. Ce qui existe mais est éteint — ordre d'activation et gain

| # | À activer | Comment | Gain |
|---|---|---|---|
| 1 | **Rappels push** (0007 + 4 variables + secret Vault) | `docs/rappels-setup.md`, ≈ 10 min | **Énorme** : l'app vient à toi (agenda, rappels). Sans ça, pas de rétention |
| 2 | **Récurrences à 4 h** (0013) | après 1 (même secret) | Fort : « tous les lundis… » enfin fiable |
| 3 | **Coque Android + test réveil** | `docs/android-setup.md` (Android Studio ≈ 30 min) | Fort : réveils/minuteurs mains pleines |
| 4 | **Voix naturelle** | écouter `/voix-test`, choisir, je branche | Fort sur l'envie de s'en servir (la voix GPS tue le plaisir) |
| 5 | **Google (agenda + mails)** (0006 + Google Cloud + 4 variables) | `docs/google-setup.md`, ≈ 20 min | Moyen-fort : briefing complet. **Attention : expire tous les 7 jours en mode Test** |
| 6 | Banque connectée | 1 connexion déjà enregistrée ; adresse de retour à confirmer | Moyen : le solde réel sans import |
| 7 | Temps d'écran réel | exige Tasker | Faible |

## 5. Ce qui ne sert à rien ou qui est trop compliqué

À **supprimer ou simplifier** (par ordre de bénéfice) :
1. **Les données fictives de l'Accueil** (`demo-data.ts` : solde 2 847 €, « Voyage en Australie », forme) — elles mentent à l'utilisateur. Un état vide soigné vaut mieux qu'un faux solde. Idem « À valider » fictif.
2. **Temps d'écran** : table + route + lib + carte fictive pour une donnée qu'une PWA ne peut pas lire. À retirer jusqu'à ce que Tasker existe.
3. **22 outils dans chaque prompt** : 12 sont rarement utiles (`update_workout`, `set_budget`, `delete_entry` (9 types), `add_recurring_task`…). Les charger **seulement quand la phrase les évoque** (routage par mots-clés en code) retire ~2 500 tokens par message.
4. **Deux chemins pour une même chose** : réveil par le code (nouveau, fiable) et par l'IA (outil) — garder le code d'abord, l'outil seulement en repli ; idem tâches rapides / récurrentes.
5. **Le miroir « Ta semaine » avec phrases d'IA** : un appel IA + vérificateur de chiffres pour 2 phrases. Utile le dimanche, pas à la demande : en faire une notification hebdomadaire (cache déjà prévu).
6. **L'import Excel/CSV + connexion bancaire + capture** : trois chemins pour les opérations. Garder la connexion bancaire, l'import en secours.
7. Le **mode « sans heure = 00:00 »** est une astuce invisible : prévoir un vrai champ « jour entier » avant d'avoir 10 utilisateurs.

## 6. Ce qui manquerait pour que les gens en parlent — mes 10 priorités

Classées par « je ne peux plus m'en passer » (R) et « je le montre à mes amis » (V).

| # | Amélioration | R | V | Effort | Risque | Pourquoi |
|---|---|---|---|---|---|---|
| 1 | **Activer rappels + briefing push** (matin 7 h 30, soir 21 h : « demain » + bilan), générés en code | ★★★ | ★ | S | faible | Sans elle, aucune habitude. Tout le reste en dépend |
| 2 | **Réponse en < 1 s pour les ordres simples** : « j'ai dépensé 12 € au resto », « ajoute… » reconnus **en code d'abord** (comme les réveils), IA seulement en repli | ★★★ | ★★ | M | faible | 13 h, 30 secondes entre deux clients : le premier essai doit marcher en 1 s. C'est la leçon du bug du réveil |
| 3 | **Détecteur d'abonnements oubliés / hausses de prix / doublons** (code pur sur les 269 opérations) | ★★ | ★★★ | M | faible | « Majordome m'a fait retrouver 43 €/mois » : l'histoire qu'on raconte. Visible dès la 1re connexion |
| 4 | **Voix naturelle** (après ton choix à l'oreille) | ★★ | ★★★ | M | faible (repli téléphone) | La voix fait l'attachement ; aujourd'hui elle dessert le produit |
| 5 | **Prompt 3× plus léger** (outils par intention, petit modèle par défaut, cache de prompt) | ★ | – | M | moyen (régressions d'outils : tests existants) | Latence −40 %, coût ÷ 3-6 : condition pour vendre à 10-15 € |
| 6 | **Mémoire visible et corrigeable à la voix** (« tu te souviens de… », « oublie que… ») + carte « ce que je sais de toi » | ★★ | ★★ | S | faible | La confiance : l'utilisateur voit ce que l'IA sait et peut le corriger |
| 7 | **Carte « Ma semaine » partageable** (image propre, sans chiffres sensibles au choix) | ★ | ★★★ | S | faible | Vecteur de bouche-à-oreille le moins cher |
| 8 | **Mode dégradé + file d'attente pour toutes les saisies** + alertes si Supabase/IA tombent | ★★ | – | M | faible | Une app de confiance ne perd jamais une saisie |
| 9 | **Onboarding « premier succès en 60 s »** : relevé → 1 insight ; ou 3 questions → 1re routine | ★★ | ★★ | M | moyen | 80 % des essais meurent au premier écran vide |
| 10 | **Vrais comptes + isolation par utilisateur** (auth, politiques RLS) | – | – | **L** | élevé | Indispensable pour vendre, **inutile tant que tu n'es pas ton propre utilisateur quotidien** |

**Ce que je ne ferais PAS, même si c'est tentant**
- Une app iOS / réécriture native (Expo) avant d'avoir prouvé l'usage en PWA + coque Android.
- Le **multi-agents**, une « marketplace d'intégrations », Notion/Slack/etc.
- **Écrire** quoi que ce soit chez la banque ou chez Google (virements, envoi de mails, création d'événements) : le jour d'un bug ou d'une injection, c'est irréversible. La lecture seule est un argument de confiance.
- Du **gamification culpabilisante** (séries, « tu as échoué ») : contredit la promesse.
- Résumer toute la boîte mail : coûteux, intrusif, juridiquement lourd (§8).
- Plus d'écrans avant que les rappels et la voix soient en place.

## 7. La tension « sans jugement » vs « conseiller franc » — un réglage de ton

**Proposition : un réglage « Ton » à 3 positions dans Réglages**, choisi par l'utilisateur, changeable à tout moment, modifiable à la voix (« sois plus direct ») :
- **Doux** (défaut) : bienveillant, jamais de reproche. Le comportement actuel.
- **Direct** : dit les choses clairement **une fois**, sans adoucir ni moraliser (« Tu as dépensé 180 € au restaurant ce mois-ci, 2,5× ton budget. »).
- **Coach** : exigeant et motivant, propose un engagement chiffré (« Cette semaine : 2 restos maximum. Tu le fais ? »).

**Implémentation à coût quasi nul (aucune migration, aucun appel en plus)** :
1. Le réglage vit dans le navigateur (comme « lecture à voix haute ») ; le client envoie `tone` avec chaque message ; le serveur ajoute **une phrase** au prompt (≈ 25 tokens) : « Ton choisi : Direct… ».
2. **Les faits sont calculés par le code, pas par l'IA** : budget dépassé de x %, 3ᵉ restaurant de la semaine, dépense > 2× la médiane (déjà codé : `isUnusual`). Le code les met dans le contexte comme « faits à la disposition du conseiller » ; l'IA ne fait que les formuler selon le ton → pas de jugement inventé.
3. **Garde-fous fixes, quel que soit le ton** : jamais d'insulte, jamais de honte ni de comparaison à d'autres, jamais de conseil médical/financier réglementé (« pas un conseiller agréé »), pas de rouge, la franchise porte sur des **faits chiffrés** et jamais sur la personne ; « Direct/Coach » ne s'active qu'après un opt-in explicite (écran d'explication de 2 lignes) et un bouton « trop dur » qui ramène à Doux.
4. Mesure simple : taux de retour à Doux = signal que le ton est trop dur.

## 8. Si on vendait demain : les 5 blocages majeurs

1. **Légal / RGPD — le plus dur.** Données financières + mails = données sensibles à fort enjeu. Il faut : base légale et consentements granulaires, **registre de traitements et analyse d'impact (AIPD)**, contrats de sous-traitance (OpenAI/Anthropic, Supabase, Vercel, Enable Banking, ElevenLabs/Google si utilisés), hébergement UE, durée de conservation, export et suppression en un tap. **Gmail** : le scope `gmail.readonly` est « restreint » chez Google : app publique = **vérification Google + audit de sécurité annuel payant (plusieurs milliers d'euros)**. Sans ça : limite de 100 utilisateurs de test et connexion qui expire tous les 7 jours. **Banque (DSP2)** : le mode « restreint » d'Enable Banking interdit l'usage commercial ; il faut leur passage commercial (ou ton propre agrément AISP).
2. **Architecture mono-utilisateur.** Pas de comptes, une base partagée, un code d'accès unique (§2) : il faut auth, isolation par utilisateur (RLS), quotas par utilisateur, facturation (Stripe), suppression de compte. C'est une **réécriture de la couche données** : L, pas un détail.
3. **Installation.** PWA installée à la main + APK debug : non vendable. Il faut le **Play Store** (compte développeur 25 $, signature de l'app, politique de confidentialité, formulaire « sécurité des données », revue Google). La coque Capacitor est un bon point de départ mais ne suffit pas.
4. **Coût et marge.** ≈ 45 $/mois d'infra fixe + 4-10 $/utilisateur actif (IA + voix) : avec 10-15 €, la marge est **serrée** si on laisse Sonnet par défaut ; exige modèle par défaut léger, plafonds, cache (§3). Sans quota par utilisateur, un seul gros utilisateur ou un abus peut coûter plus que son abonnement.
5. **Support et concurrence.** Support : un assistant qui touche à l'argent et aux rappels génère des « pourquoi ça n'a pas sonné ? » ; il faut monitoring, journaux exploitables, un canal de support, des conditions d'utilisation claires. Concurrence : Revolut (IA intégrée), banques, Apple / Google (assistants natifs, rappels, agenda), ChatGPT / Gemini avec mémoire, applis de budget (Bobby, Cleo, Finary). **Notre différence défendable** : « une vie en ordre » (agenda + tâches + argent + corps) par la **voix**, avec une confiance forte (lecture seule, annulation, ton choisi) ; elle n'existe que si les rappels, la voix et la rapidité sont impeccables.

---

**Verdict** : la base technique est saine et honnête (lecture seule, annulation, tests, coûts maîtrisés). Le risque n'est pas technique : c'est **de continuer à construire avant d'avoir un usage quotidien**. Active les rappels, choisis la voix, fais le test du réveil, puis utilise l'app 2 semaines. Les 10 priorités ci-dessus viennent ensuite, dans cet ordre.
