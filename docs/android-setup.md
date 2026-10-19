# Coque Android de majordome. — installation pas à pas (Windows, débutant)

**À quoi ça sert** : en PWA, Android oblige à toucher un bouton pour ouvrir l'Horloge. Avec cette « coque » (une petite appli Android qui affiche ton site), tu dis « mets un réveil à 7 h » ou « minuteur de 5 minutes » et c'est **réglé dans la vraie Horloge, sans toucher l'écran**. L'appli répète à voix haute : « Ok, réveil réglé à sept heures. »

**Ce qui ne change pas** : le site reste sur Vercel. La coque ne contient aucune page : elle ouvre `https://majordome-bice.vercel.app` et n'a le droit d'aller que sur ce domaine. Quand je modifie le site, tu n'as **rien à réinstaller**. Tu ne refais l'APK que si je change le plugin Android.

## Ce que j'ai vérifié sur ton PC (18/10)
| Outil | État |
|---|---|
| Node 22 + npm 10 | ✅ déjà installés, rien à faire |
| Java (JDK) | ❌ absent — **mais Android Studio en apporte un** : n'installe pas de JDK à part |
| Android Studio / SDK Android / adb | ❌ absents → étape 1 |

## Les étapes (une par une)

### 1. Installer Android Studio (≈ 30 min, ≈ 6 Go)
1. Va sur https://developer.android.com/studio → **Download Android Studio** → accepte les conditions → télécharge, lance l'installeur (tout laisser par défaut).
2. Au premier lancement : **Standard** → **Next** → accepte les licences (coche tout) → **Finish**. Il télécharge le SDK Android tout seul. Attends la fin.

### 2. Ouvrir le projet
1. Android Studio → **Open** → choisis le dossier `C:\Users\cerqueira ruben\dev\majordome\android\android` (le dossier qui contient `gradlew.bat` — pas `android` tout seul).
2. Clique **Trust Project**. En bas, « Gradle sync » tourne : la 1re fois ça télécharge beaucoup, **5 à 15 min**. Attends « Gradle sync finished ».
3. S'il propose « Update Gradle / Android Gradle Plugin » : **ne le fais pas** (clique la croix / « Remind me never »).

### 3. Vérifier le SDK (1 min)
**Tools → SDK Manager**. Onglet *SDK Platforms* : **Android 16 (API 36)** coché. Onglet *SDK Tools* : **Android SDK Build-Tools** et **Android SDK Platform-Tools** cochés. **Apply** si tu changes quelque chose.

### 4. Fabriquer l'APK debug (2 min)
1. Menu **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
2. Une bulle « APK(s) generated successfully » apparaît : **locate**. Le fichier est ici :
   `android\android\app\build\outputs\apk\debug\app-debug.apk`
3. (Ligne de commande, si tu préfères — dans un terminal :)
   ```bash
   set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
   cd C:\Users\cerqueira ruben\dev\majordome\android\android
   gradlew.bat assembleDebug
   ```

### 5. Préparer ton téléphone
1. **Paramètres → À propos du téléphone** → touche **Numéro de build** 7 fois (il dit « Vous êtes développeur »).
2. **Paramètres → Système → Options pour les développeurs** → active **Débogage USB**.

### 6. Installer l'APK
**Méthode simple** : branche le téléphone en USB, choisis « Transfert de fichiers », copie `app-debug.apk` dedans, ouvre-le depuis l'appli Fichiers du téléphone, autorise « installer des applis inconnues » pour Fichiers, **Installer**.
**Méthode ligne de commande** (téléphone branché, débogage USB accepté) :
```bash
"%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" install -r android\android\app\build\outputs\apk\debug\app-debug.apk
```

### 7. Premier test : le réveil à +2 minutes
1. Ouvre l'appli **majordome.** (nouvelle icône), entre ton code d'accès.
2. Avatar **R** → **Réglages** → **Test réveil dans 2 minutes** (cette ligne n'existe **que** dans la coque).
3. Résultat attendu : « Ok, réveil réglé à … » puis, dans l'appli **Horloge** du téléphone, un nouveau réveil « Test majordome » dans 2 minutes, sans que l'Horloge se soit ouverte.
4. **Dis-moi ce qui s'est passé** (réglé ? message d'erreur ?). Tant que ce test n'est pas validé, on ne va pas plus loin.

### 8. Si ça marche
Dis simplement « mets un réveil à 7 h demain » ou « minuteur de 5 minutes » : l'appli règle l'Horloge toute seule et le dit à voix haute.

## Temps d'écran réel (plugin Usage, ajouté le 19/10)
Après avoir reconstruit et réinstallé l'APK (étapes 4 et 6) : ouvre l'onglet **Forme** → carte « Temps d'écran » → **Autoriser l'accès** → dans la liste d'Android, choisis **majordome** → active « Autoriser l'accès aux données d'utilisation » → reviens dans l'appli et rouvre Forme : le chiffre du jour apparaît. **Non compilé ici** (pas d'Android Studio) : si la compilation échoue, copie-moi l'erreur.

## Erreurs fréquentes
| Message / symptôme | Que faire |
|---|---|
| `SDK location not found` | Android Studio : **File → Project Structure → SDK Location**, ou crée `android\android\local.properties` avec `sdk.dir=C:\\Users\\cerqueira ruben\\AppData\\Local\\Android\\Sdk` |
| `JAVA_HOME is not set` / `Unsupported class file major version` | Utilise le JDK d'Android Studio (`...\Android Studio\jbr`, Java 21) : en ligne de commande, fais la ligne `set JAVA_HOME=…` de l'étape 4. |
| `Could not resolve …` pendant le Gradle sync | Internet coupé, VPN ou proxy : réessaie (**File → Sync Project with Gradle Files**). |
| Le téléphone n'apparaît pas | Câble « données » (pas seulement charge), mode « Transfert de fichiers », débogage USB accepté (popup « Autoriser ce PC ? » → **Toujours**). `adb devices` doit lister l'appareil, pas « unauthorized ». |
| `INSTALL_FAILED_UPDATE_INCOMPATIBLE` | Une autre version signée autrement est installée : désinstalle « majordome. » du téléphone puis réinstalle. |
| Écran blanc / « page introuvable » au lancement | Pas de réseau sur le téléphone, ou Vercel injoignable : l'appli charge le site en ligne. |
| « Aucune application Horloge ne peut régler ça » | L'appli Horloge du téléphone ne gère pas les réglages par d'autres applis (rare). Dis-le-moi avec la marque du téléphone. |
| L'Horloge s'ouvre quand même | Certaines marques (Samsung, Xiaomi) ignorent le mode silencieux : le réveil est bien réglé, il s'affiche juste. À me signaler. |
| Connexion Google / banque : la page s'ouvre dans Chrome | Normal : la coque n'a le droit d'ouvrir que notre domaine. Fais ces connexions **une fois** depuis Chrome ; elles sont gardées côté serveur. |

## Si le test échoue : plan B (rien n'est codé)
Tasker (appli Android payante, ~3 €) + **ntfy** (service de notifications gratuit) : majordome enverrait un message ntfy (« alarme 07:00 »), Tasker l'écouterait en arrière-plan et réglerait l'Horloge avec son action « Définir une alarme ». Il faut installer Tasker, créer un sujet ntfy secret et une variable d'environnement. Plus fragile et plus de réglages que la coque, donc seulement si le plugin est refusé par ton téléphone.

## Ce que la coque ne fait pas (volontairement)
- Pas de publication sur le Play Store, pas de clé de signature : **APK debug seulement**. Aucune clé ni secret n'est dans git (`.gitignore`).
- Elle ne contient pas le site : pas de mode hors ligne spécial.
