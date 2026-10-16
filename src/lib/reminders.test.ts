import { describe, expect, it } from "vitest";
import { dueReminders, reminderPayload, type ReminderTask } from "./reminders";

const now = new Date("2026-10-16T10:00:00+02:00");
const t = (id: number, due: string | null, extra: Partial<ReminderTask> = {}): ReminderTask => ({ id, title: `Tâche ${id}`, due_at: due, status: "todo", reminded_at: null, ...extra });

describe("dueReminders", () => {
  it("prend ce qui tombe dans les 5 prochaines minutes ou dans l'heure écoulée", () => {
    const tasks = [
      t(1, "2026-10-16T10:04:00+02:00"), // dans 4 min → oui
      t(2, "2026-10-16T10:06:00+02:00"), // dans 6 min → au prochain passage
      t(3, "2026-10-16T09:30:00+02:00"), // il y a 30 min → oui (cron raté, téléphone éteint…)
      t(4, "2026-10-16T08:30:00+02:00"), // il y a 1 h 30 → non
      t(5, null),
      t(6, "2026-10-16T10:01:00+02:00", { status: "done" }),
      t(7, "2026-10-16T10:01:00+02:00", { reminded_at: "2026-10-16T07:55:00Z" }),
    ];
    expect(dueReminders(tasks, now).map((x) => x.id)).toEqual([1, 3]);
  });
});

describe("reminderPayload", () => {
  it("formule selon l'avance ou le retard, à l'heure de Paris", () => {
    expect(reminderPayload(t(1, "2026-10-16T10:04:00+02:00"), now)).toEqual({ title: "Tâche 1", body: "Dans 4 min (10:04)", tag: "task-1", url: "/" });
    expect(reminderPayload(t(2, "2026-10-16T10:00:00+02:00"), now).body).toBe("Maintenant (10:00)");
    expect(reminderPayload(t(3, "2026-10-16T09:30:00+02:00"), now).body).toBe("C'était prévu à 09:30");
  });
});

describe("tâche sans heure", () => {
  it("ne déclenche jamais de rappel (seul l'agenda, avec une heure précise, notifie)", () => {
    expect(dueReminders([t(1, "2026-10-16T00:00:00+02:00"), t(2, null)], new Date("2026-10-16T00:01:00+02:00"))).toEqual([]);
    expect(dueReminders([t(3, "2026-10-16T10:00:00+02:00")], now)).toHaveLength(1);
  });
});
