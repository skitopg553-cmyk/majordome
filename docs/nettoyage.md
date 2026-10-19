# Proposition de nettoyage de ta semaine (rien n'est supprimé tant que tu n'as pas dit OK)

**Situation actuelle (lue dans la base le 19/10)** : 44 règles dans `recurring_tasks` (la description de ta semaine a été enregistrée DEUX fois, ids 1 à 22 puis 23 à 44, chaque cours coupé en « Cours / Pause / Reprise / Fin de cours » avec une seule heure) et 8 tâches du lundi 19 créées à partir de ces règles (ids 15 à 22 dans `tasks`, dont des doublons et des « Pause » sans heure). Ta tâche « Restaurant avec Arthur » (id 14, lundi 19 à 20 h) est correcte : **on la garde**.

**À faire après l'application de la migration 0014** (sans elle, les colonnes `days`, `end_time`, `habit` n'existent pas). Ordre : 0014 → ce nettoyage.

## Ce que je propose de créer (9 créneaux, d'après ton message du 19/10)

| Créneau | Jours | Heures | Habitude à confirmer |
|---|---|---|---|
| Cours | mardi, mercredi, jeudi, vendredi | 9 h-12 h | non |
| Cours | lundi | 9 h-13 h | non |
| Cours | lundi | 14 h-18 h | non |
| Cours | mardi | 12 h 30-17 h 30 | non |
| Cours | mercredi, jeudi | 13 h 30-17 h | non |
| Cours | vendredi | 13 h 30-16 h | non |
| Salle de muscu | mercredi, jeudi, vendredi | 12 h-13 h 30 | **oui** |
| Boxe anglaise | mardi | 18 h 30-20 h | **oui** |
| Travail Otacos | vendredi, dimanche | 18 h 30-23 h | non |

## Ce que je propose de supprimer (après ton OK)
- Les 44 règles actuelles (ids 1 à 44) : remplacées par le tableau ci-dessus.
- Les tâches ids 15 à 22 (copies du lundi 19) : remplacées par les créneaux.

## Mes hypothèses : dis-moi celles qui sont fausses
1. **Salle de muscu le mercredi et le jeudi** : tu as écrit « 12h où je fais la salle de muscu » : je pars du principe que c'est pendant la pause de midi, 12 h-13 h 30 comme le vendredi.
2. **Boxe anglaise** : tu n'as donné que le début (18 h 30) : j'ai mis 20 h comme fin, à corriger.
3. **Lundi 13 h-14 h** : « pause » : aucun créneau (le cours du matin finit à 13 h, celui de l'après-midi commence à 14 h).
4. **Fin du vendredi** : « je finis à 16 h » : cours 13 h 30-16 h.

## Le SQL (je ne le lance pas sans ton OK)
```sql
-- 1) créneaux propres
insert into public.recurring_tasks (title, kind, weekday, days, at_time, end_time, habit) values
  ('Cours',                 'weekly', 2, '2,3,4,5', '09:00', '12:00', 0),
  ('Cours',                 'weekly', 1, '1',       '09:00', '13:00', 0),
  ('Cours',                 'weekly', 1, '1',       '14:00', '18:00', 0),
  ('Cours',                 'weekly', 2, '2',       '12:30', '17:30', 0),
  ('Cours',                 'weekly', 3, '3,4',     '13:30', '17:00', 0),
  ('Cours',                 'weekly', 5, '5',       '13:30', '16:00', 0),
  ('Salle de muscu',        'weekly', 3, '3,4,5',   '12:00', '13:30', 1),
  ('Boxe anglaise',         'weekly', 2, '2',       '18:30', '20:00', 1),
  ('Travail Otacos',        'weekly', 5, '5,7',     '18:30', '23:00', 0);
-- 2) anciennes règles et copies du lundi (à ne lancer qu'APRÈS avoir vérifié l'étape 1 dans l'app)
delete from public.recurring_tasks where id between 1 and 44;
delete from public.tasks where id between 15 and 22;
```
(Le premier « Cours » 9 h-12 h couvre mardi à vendredi ; le lundi est à part car il finit à 13 h.)

**Après le nettoyage** : « Salle de muscu » et « Boxe anglaise » sont des habitudes : l'appli te demandera « Tu y es allé ? » après le créneau.
