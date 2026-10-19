import { describe, expect, it } from "vitest";
import { dueReminders, reminderPayload, type ReminderTask, dueOccurrenceReminders } from "./reminders";

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

describe("rappels des créneaux qui reviennent (cours, boxe…)", () => {
  const boxe = { id: 5, title: "Boxe anglaise", kind: "weekly" as const, weekday: 2, days: "2", month_day: null, at_time: "18:30", end_time: "20:00", habit: 1, last_generated: null, created_at: "2026-10-01T00:00:00Z" };
  // mardi 20/10/2026, 18 h 30 à Paris = 16:30Z
  it("un seul passage du cron le rappelle : celui de 18 h 25 (début dans 4 à 5 min)", () => {
    expect(dueOccurrenceReminders([boxe], [], new Date("2026-10-20T16:24:59Z"))).toEqual([]); // 5 min 01 avant
    const r = dueOccurrenceReminders([boxe], [], new Date("2026-10-20T16:25:00Z"));
    expect(r).toEqual([{ title: "Boxe anglaise", body: "Dans 5 min (18:30)", tag: "rule-5:2026-10-20", url: "/" }]);
    expect(dueOccurrenceReminders([boxe], [], new Date("2026-10-20T16:26:00Z"))).toEqual([]); // passage suivant : déjà fait
  });
  it("pas un autre jour, pas une occurrence supprimée ; une occurrence déplacée est rappelée à sa nouvelle heure", () => {
    expect(dueOccurrenceReminders([boxe], [], new Date("2026-10-21T16:25:00Z"))).toEqual([]);
    expect(dueOccurrenceReminders([boxe], [{ rule_id: 5, day: "2026-10-20", action: "skip", new_day: null, new_start: null, new_end: null }], new Date("2026-10-20T16:25:00Z"))).toEqual([]);
    const moved = [{ rule_id: 5, day: "2026-10-20", action: "move" as const, new_day: "2026-10-20", new_start: "19:00", new_end: "20:30" }];
    expect(dueOccurrenceReminders([boxe], moved, new Date("2026-10-20T16:25:00Z"))).toEqual([]);
    expect(dueOccurrenceReminders([boxe], moved, new Date("2026-10-20T16:55:00Z"))).toHaveLength(1);
  });
  it("juste après minuit : le créneau du lendemain est trouvé", () => {
    const nuit = { ...boxe, days: "3", weekday: 3, at_time: "00:03", end_time: "01:00" };
    expect(dueOccurrenceReminders([nuit], [], new Date("2026-10-20T21:58:00Z"))).toHaveLength(1); // 23 h 58 mardi → 0 h 03 mercredi
  });
});
