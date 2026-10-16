# Temps d'écran : envoyer le chiffre depuis Tasker

Une application web ne peut pas lire le temps d'écran du téléphone. Trois façons de le saisir :
1. **À la voix** : « 4 h d'écran aujourd'hui » (outil `log_screen_time`).
2. **Écran Forme → carte Temps d'écran → Saisir** : boutons − / +, ou « Lire une capture » (capture d'écran de « Bien-être numérique », lue par l'IA, avec **confirmation avant d'enregistrer**).
3. **Tasker** (automatique, plus tard) : une requête HTTP vers la route ci-dessous.

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
