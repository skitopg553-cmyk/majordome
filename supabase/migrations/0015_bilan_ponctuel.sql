-- Bilan d'une séance de sport PONCTUELLE (« Demain je vais courir à 7 h ») : la réponse « oui / non » est gardée sur la tâche elle-même.
-- AJOUT uniquement (colonne nullable) : rien n'est supprimé ni modifié. Sans cette migration, l'app marche comme avant (pas de bilan pour les séances ponctuelles).
alter table public.tasks add column if not exists habit_status text check (habit_status in ('done', 'missed'));
