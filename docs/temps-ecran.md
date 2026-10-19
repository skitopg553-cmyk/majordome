# Temps d'écran : envoyer le chiffre depuis Tasker

Une application web ne peut pas lire le temps d'écran du téléphone. **État actuel (19/10)** : plus aucun chiffre fictif. La carte « Temps d'écran » de Forme affiche les VRAIS chiffres de la table `screen_time_logs`, alimentée de deux façons :

1. **Automatique, dans l'appli Android de majordome** (plugin `Usage`, `UsageStatsManager`) : à l'ouverture de Forme, l'appli lit les 14 derniers jours et les envoie à la route ci-dessous. Il faut autoriser UNE fois « Accès aux données d'utilisation » (bouton « Autoriser l'accès » sur la carte → réglages d'Android → majordome → activer). Nécessite de reconstruire l'APK (voir `docs/android-setup.md`). Limite : le total additionne toutes les applis au premier plan, lanceur d'écran d'accueil compris, donc il peut dépasser un peu le chiffre de « Bien-être numérique ».
2. **Tasker** (alternative, ci-dessous).

Sur le web (navigateur, PWA), la carte explique que seule l'appli Android peut le lire.

## La route

`POST https://majordome-bice.vercel.app/api/screen-time`

| En-tête | Valeur |
|---|---|
| `x-access-code` | ton code d'accès (comme l'app) |
| `Content-Type` | `application/json` |

Corps JSON (un des deux) :

```json
{ "minutes": 252 }
```
```json
{ "hours": 4, "minutes": 12, "date": "2026-10-16" }
```

- `date` est facultative (AAAA-MM-JJ, jamais dans le futur) : absente = aujourd'hui (heure de Paris).
- Un jour = une valeur : renvoyer la même date **remplace** le chiffre.
- Réponse : `{ "ok": true, "date": "…", "minutes": 252 }`. Erreurs : 400 (valeur invalide), 401 (code d'accès faux, ou trop d'essais), 503 (migration 0011 non appliquée).

## Dans Tasker (idée, non testée)
Tâche → Réseau → **Requête HTTP** : Méthode POST, URL ci-dessus, En-têtes `x-access-code:TON_CODE` et `Content-Type:application/json`, Corps `{"minutes":%MINUTES}`. Déclenchez-la le soir (profil « Heure »). Il faut que `%MINUTES` vienne d'une source de temps d'écran (par ex. l'API UsageStats via un plugin) : Tasker seul ne la donne pas.
