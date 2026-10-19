# Nettoyage proposé : repartir propre (rien n'est supprimé tant que tu n'as pas dit OK)

**Ce qu'il y a dans la base (lu le 19/10, sans rien modifier)** :
- **36 règles récurrentes** (`recurring_tasks`), toutes créées par l'IA le 19/10 entre 12 h 04 et 12 h 06 (heure de Paris) : ta semaine en double, avec des titres différents (« Cours le lundi » / « Cours lundi »), sans heure de fin, et des faux événements (« Pause lundi », « Fin de cours le jeudi », « Reprise mercredi »…).
- **6 tâches** recopiées à partir de ces règles le lundi 19 (ids 15, 17, 18, 19, 21, 22) : « Cours le lundi », « Cours le lundi après-midi », « Fin de cours le lundi », en double.
- « Restaurant avec Arthur » n'existe plus (supprimé lors de ta demande « supprime toutes les tâches »).

**Proposition : tout supprimer, puis recréer ta semaine proprement** (au choix : tu la dictes à Majordome avec la nouvelle version, ou je l'enregistre moi-même avec ton OK, voir plus bas).

## 1. Vérifier (lecture seule)
```sql
select count(*) from public.recurring_tasks where created_at >= '2026-10-19 00:00+02' and created_at < '2026-10-20 00:00+02'; -- 36 attendu
select count(*) from public.recurring_tasks; -- 36 attendu (rien d'autre)
select id, title from public.tasks where id in (15, 17, 18, 19, 21, 22); -- les 6 copies
```

## 2. Supprimer (après ton OK)
```sql
delete from public.recurring_tasks where created_at >= '2026-10-19 00:00+02' and created_at < '2026-10-20 00:00+02';
delete from public.tasks where id in (15, 17, 18, 19, 21, 22);
```
(Les exceptions et le journal des habitudes de ces règles partent avec elles ; il n'y en a aucun aujourd'hui.)

## 3. Facultatif : ta semaine réelle, enregistrée directement (après ton OK)
Les 12 pavés de ta description, avec leur heure de fin. Boxe et muscu sont des habitudes (l'app te demandera « Tu y es allé ? »). **O'Tacos : tu n'as donné que le début (18 h 30) : j'ai mis 23 h comme fin, comme le 19/10. Corrige-moi si c'est faux.**
```sql
insert into public.recurring_tasks (title, kind, weekday, days, at_time, end_time, habit) values
  ('Cours',           'weekly', 1, '1',   '09:00', '12:00', 0),
  ('Cours',           'weekly', 1, '1',   '14:00', '18:00', 0),
  ('Cours',           'weekly', 2, '2',   '09:00', '12:00', 0),
  ('Cours',           'weekly', 2, '2',   '12:30', '17:30', 0),
  ('Boxe anglaise',   'weekly', 2, '2',   '18:30', '20:00', 1),
  ('Cours',           'weekly', 3, '3,4', '09:00', '12:00', 0),
  ('Muscu',           'weekly', 3, '3,4', '12:00', '13:30', 1),
  ('Cours',           'weekly', 3, '3,4', '13:30', '17:00', 0),
  ('Cours',           'weekly', 5, '5',   '09:00', '12:00', 0),
  ('Muscu',           'weekly', 5, '5',   '12:00', '13:00', 1),
  ('Cours',           'weekly', 5, '5',   '13:00', '16:00', 0),
  ('Travail O''Tacos', 'weekly', 5, '5,7', '18:30', '23:00', 0);
```
