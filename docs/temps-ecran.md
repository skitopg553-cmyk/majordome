# Temps d'écran : envoyer le chiffre depuis Tasker

Une application web ne peut pas lire le temps d'écran du téléphone. **État actuel : la carte « Temps d'écran » de Forme est un APERÇU fictif** (bandeau « fictif »). La lecture de capture d'écran par l'IA et l'outil vocal ont été retirés ; seules la table `screen_time_logs` (migration 0011) et la route ci-dessous existent, et rien dans l'app ne les lit ni ne les écrit (prêt pour Tasker).

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
