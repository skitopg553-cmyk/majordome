import { isAgenda } from "./planning";

// Rappels (fin de phase 1) : quelles tâches notifier maintenant, et avec quel texte. Logique pure, testée.

export type ReminderTask = { id: number; title: string; due_at: string | null; status: string; reminded_at: string | null };

export const LEAD_MIN = 5; // on prévient jusqu'à 5 min avant l'échéance (le cron tourne toutes les 5 min)
export const LATE_MIN = 60; // une tâche dont l'heure est passée depuis plus d'1 h n'est plus « rappelée » (pas de rafale au réveil)

/** Tâches à rappeler à l'instant `now` : à faire, datées, jamais rappelées, échéance dans la fenêtre [now − 60 min, now + 5 min]. */
export function dueReminders(tasks: ReminderTask[], now: Date) {
  const from = now.getTime() - LATE_MIN * 60_000;
  const to = now.getTime() + LEAD_MIN * 60_000;
  return tasks.filter((t) => {
    if (t.status !== "todo" || !isAgenda(t) || t.reminded_at) return false; // une tâche sans heure ne déclenche pas de rappel
    const due = new Date(t.due_at!).getTime();
    return due >= from && due <= to;
  });
}

/** Contenu de la notification : court, en français simple. */
export function reminderPayload(t: ReminderTask, now: Date) {
  const due = new Date(t.due_at!);
  const min = Math.round((due.getTime() - now.getTime()) / 60_000);
  const time = due.toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" });
  const body = min > 0 ? `Dans ${min} min (${time})` : min === 0 ? `Maintenant (${time})` : `C'était prévu à ${time}`;
  return { title: t.title, body, tag: `task-${t.id}`, url: "/" };
}
