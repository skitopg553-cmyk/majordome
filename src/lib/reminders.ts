import { isAgenda } from "./planning";
import type { StoredRule } from "./recurrence";
import { occurrencesOn, type SlotException } from "./slots";
import { addDays, parisDay } from "./task-groups";

// Rappels (fin de phase 1) : quelles tâches notifier maintenant, et avec quel texte. Logique pure, testée.

export type ReminderTask = { id: number; title: string; due_at: string | null; status: string; reminded_at: string | null };

export const LEAD_MIN = 5; // on prévient jusqu'à 5 min avant l'échéance (le cron tourne chaque minute)
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

/**
 * Créneaux qui REVIENNENT (cours, boxe…) : ils ne sont pas dans la table tasks, donc pas de « reminded_at » pour s'en souvenir.
 * On prévient une seule fois, au passage du cron dont la minute tombe pile LEAD_MIN avant le début : début dans ]now + 4 min, now + 5 min].
 * shortcut: un passage du cron manqué (panne) = ce rappel-là est perdu ; ajouter un journal des rappels envoyés si ça arrive en vrai.
 */
export function dueOccurrenceReminders(rules: StoredRule[], exceptions: SlotException[], now: Date) {
  const from = now.getTime() + (LEAD_MIN - 1) * 60_000;
  const to = now.getTime() + LEAD_MIN * 60_000;
  const today = parisDay(now);
  return [today, addDays(today, 1)] // minuit : un cours à 0 h 03 tombe le lendemain
    .flatMap((d) => occurrencesOn(rules, exceptions, d))
    .filter((o) => {
      const t = Date.parse(o.start);
      return t > from && t <= to;
    })
    .map((o) => ({ ...reminderPayload({ id: o.ruleId, title: o.title, due_at: o.start, status: "todo", reminded_at: null }, now), tag: `rule-${o.key}` }));
}
