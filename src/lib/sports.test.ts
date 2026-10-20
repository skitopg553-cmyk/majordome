import { describe, expect, it } from "vitest";
import { canonicalSport, classifySport, distribution, plannedSessions, recordHabitSession, regularity, slotMinutes, streak, type WorkoutStore } from "./sports";
import type { StoredRule } from "./recurrence";

describe("classement des sports (dictionnaire en code)", () => {
  it("sports connus, avec accents et casse libres", () => {
    expect(classifySport("Boxe anglaise")).toEqual({ kind: "sport", sport: "Boxe anglaise" });
    expect(classifySport("boxe")).toEqual({ kind: "sport", sport: "Boxe anglaise" });
    expect(classifySport("Boxe thaï")).toEqual({ kind: "sport", sport: "Boxe thaï" });
    expect(classifySport("Muscu")).toEqual({ kind: "sport", sport: "Musculation" });
    expect(classifySport("Salle")).toEqual({ kind: "sport", sport: "Musculation" });
    expect(classifySport("Course à pied")).toEqual({ kind: "sport", sport: "Course à pied" });
    expect(classifySport("Footing du matin")).toEqual({ kind: "sport", sport: "Course à pied" });
    expect(classifySport("Natation")).toEqual({ kind: "sport", sport: "Natation" });
    expect(classifySport("Vélo")).toEqual({ kind: "sport", sport: "Vélo" });
    expect(classifySport("Foot avec Arthur")).toEqual({ kind: "sport", sport: "Football" });
    expect(classifySport("Yoga")).toEqual({ kind: "sport", sport: "Yoga" });
  });
  it("méditation, lecture, créatine : habitudes non sportives connues (pas d'IA)", () => {
    for (const t of ["Méditation", "Lecture", "Prendre ma créatine", "Boire de l'eau"]) expect(classifySport(t)).toEqual({ kind: "other" });
  });
  it("faux amis : « salle de réunion », « courses » ne sont pas du sport", () => {
    expect(classifySport("Salle de réunion")).toEqual({ kind: "other" });
    expect(classifySport("Faire les courses").kind).not.toBe("sport");
  });
  it("titre absent du dictionnaire : inconnu (seul cas où l'IA est consultée)", () => {
    expect(classifySport("Kung-fu")).toEqual({ kind: "unknown" });
  });
  it("noms regroupés : « Salle » et « Muscu » donnent « Musculation » ; un type inconnu reste tel quel", () => {
    expect(canonicalSport("Salle")).toBe("Musculation");
    expect(canonicalSport("Kung-fu")).toBe("Kung-fu");
  });
});

describe("durée du créneau", () => {
  it("fin − début, null sans fin ou fin avant début", () => {
    expect(slotMinutes("18:30", "20:00")).toBe(90);
    expect(slotMinutes("18:30", null)).toBeNull();
    expect(slotMinutes("20:00", "18:00")).toBeNull();
  });
});

const memory = () => {
  const rows: { date: string; kind: string; minutes: number | null }[] = [];
  const store: WorkoutStore = { has: async (d, k) => rows.some((r) => r.date === d && r.kind === k), add: async (w) => void rows.push(w) };
  return { rows, store };
};

describe("« Oui » à une habitude → séance dans Forme", () => {
  const boxe = { title: "Boxe anglaise", at_time: "18:30", end_time: "20:00" };
  it("crée la séance : sport déduit, jour du créneau, durée du créneau", async () => {
    const { rows, store } = memory();
    expect(await recordHabitSession(boxe, "2026-10-20", store)).toBe("created");
    expect(rows).toEqual([{ date: "2026-10-20", kind: "Boxe anglaise", minutes: 90 }]);
  });
  it("pas de doublon si je réponds deux fois (habitude déjà confirmée, ou séance déjà là)", async () => {
    const { rows, store } = memory();
    await recordHabitSession(boxe, "2026-10-20", store);
    expect(await recordHabitSession(boxe, "2026-10-20", store, { alreadyDone: true })).toBe("exists");
    expect(await recordHabitSession(boxe, "2026-10-20", store)).toBe("exists");
    expect(rows).toHaveLength(1);
  });
  it("méditation : aucune séance", async () => {
    const { rows, store } = memory();
    expect(await recordHabitSession({ title: "Méditation", at_time: "07:00", end_time: "07:10" }, "2026-10-20", store)).toBe("not-sport");
    expect(rows).toHaveLength(0);
  });
  it("sport inconnu : l'IA est consultée ; sans réponse (ou en erreur), pas de séance", async () => {
    const a = memory();
    expect(await recordHabitSession({ title: "Kung-fu", at_time: "19:00", end_time: null }, "2026-10-20", a.store, { askAI: async () => "Kung-fu" })).toBe("created");
    expect(a.rows[0]).toEqual({ date: "2026-10-20", kind: "Kung-fu", minutes: null });
    const b = memory();
    expect(await recordHabitSession({ title: "Kung-fu", at_time: "19:00", end_time: null }, "2026-10-20", b.store, { askAI: async () => null })).toBe("not-sport");
    expect(await recordHabitSession({ title: "Kung-fu", at_time: "19:00", end_time: null }, "2026-10-20", b.store, { askAI: async () => { throw new Error("pas de clé"); } })).toBe("not-sport");
    expect(b.rows).toHaveLength(0);
  });
  it("l'IA n'est jamais consultée pour un sport connu ou une habitude connue", async () => {
    let calls = 0;
    const askAI = async () => (calls++, "X");
    await recordHabitSession(boxe, "2026-10-20", memory().store, { askAI });
    await recordHabitSession({ title: "Lecture", at_time: "21:00", end_time: null }, "2026-10-20", memory().store, { askAI });
    expect(calls).toBe(0);
  });
});

// Mardi 20/10/2026, 21 h (Paris). Boxe mardi 18 h 30-20 h ; muscu lundi/mercredi/vendredi 12 h-13 h 30 ; méditation tous les jours.
const now = new Date("2026-10-20T19:00:00Z");
const rule = (id: number, title: string, days: string, at: string, end: string | null): StoredRule => ({ id, title, kind: "weekly", weekday: Number(days[0]), month_day: null, days, at_time: at, end_time: end, habit: 1, last_generated: null, created_at: "2026-09-01T08:00:00Z" });
const rules = [rule(1, "Boxe anglaise", "2", "18:30", "20:00"), rule(2, "Muscu", "1,3,5", "12:00", "13:30"), rule(3, "Méditation", "1,2,3,4,5,6,7", "07:00", "07:10")];

describe("séances prévues, régularité, répartition, série", () => {
  it("seules les habitudes sportives sont prévues (pas la méditation)", () => {
    const p = plannedSessions({ rules, exceptions: [], logs: [], workouts: [], now, back: 7 });
    expect(p.every((x) => x.sport === "Boxe anglaise" || x.sport === "Musculation")).toBe(true);
    expect(p.find((x) => x.sport === "Boxe anglaise" && x.day === "2026-10-20")?.status).toBe("pending"); // terminée, sans réponse
    expect(p.find((x) => x.sport === "Musculation" && x.day === "2026-10-21")?.status).toBe("upcoming"); // mercredi : à venir
  });
  it("« Oui » (journal) ou séance saisie à la main = faite ; « Non » = manquée", () => {
    const p = plannedSessions({
      rules, exceptions: [], now, back: 7,
      logs: [{ rule_id: 1, day: "2026-10-20", status: "done" }, { rule_id: 2, day: "2026-10-19", status: "missed" }],
      workouts: [{ date: "2026-10-16", kind: "Salle", minutes: 60 }],
    });
    expect(p.find((x) => x.key === "1:2026-10-20")?.status).toBe("done");
    expect(p.find((x) => x.key === "2:2026-10-19")?.status).toBe("missed");
    expect(p.find((x) => x.key === "2:2026-10-16")?.status).toBe("done"); // « Salle » = Musculation
  });
  it("régularité : faites / prévues terminées (une séance sans réponse compte comme non faite), en %", () => {
    const p = plannedSessions({ rules, exceptions: [], now, back: 14, logs: [{ rule_id: 1, day: "2026-10-20", status: "done" }, { rule_id: 1, day: "2026-10-13", status: "missed" }], workouts: [] });
    const r = regularity(p);
    expect(r.find((x) => x.sport === "Boxe anglaise")).toEqual({ sport: "Boxe anglaise", done: 1, planned: 3, pct: 33 });
    expect(r.find((x) => x.sport === "Musculation")!.done).toBe(0);
  });
  it("répartition par sport sur la période (séances prévues ou non)", () => {
    const d = distribution([{ date: "2026-10-20", kind: "Boxe anglaise", minutes: 90 }, { date: "2026-10-19", kind: "Muscu", minutes: 60 }, { date: "2026-10-16", kind: "Salle", minutes: 60 }, { date: "2026-08-01", kind: "Yoga", minutes: 30 }], "2026-09-22");
    expect(d).toEqual([{ sport: "Musculation", n: 2, pct: 67 }, { sport: "Boxe anglaise", n: 1, pct: 33 }]);
    expect(distribution([], "2026-09-22")).toEqual([]);
  });
  it("série : séances prévues faites d'affilée, coupée à la première non faite", () => {
    const logs = [{ rule_id: 1, day: "2026-10-20", status: "done" as const }, { rule_id: 1, day: "2026-10-13", status: "done" as const }, { rule_id: 1, day: "2026-10-06", status: "missed" as const }];
    const p = plannedSessions({ rules: [rules[0]], exceptions: [], now, back: 21, logs, workouts: [] });
    expect(streak(p)).toBe(2);
    expect(streak([])).toBe(0);
  });
});

describe("séances ponctuelles (« demain je vais courir à 7 h »)", () => {
  const run = { id: 7, title: "Course à pied", due_at: "2026-10-20T05:00:00Z", end_at: "2026-10-20T06:00:00Z", status: "todo" as const, habit_status: null }; // mardi 7 h-8 h Paris
  it("terminée et sans réponse : « pending » ; à venir : « upcoming » ; confirmée : « done »", () => {
    const at = (iso: string, o = {}) => plannedSessions({ rules: [], exceptions: [], logs: [], workouts: [], now: new Date(iso), back: 7, oneoffs: [{ ...run, ...o }] })[0];
    expect(at("2026-10-20T04:00:00Z").status).toBe("upcoming");
    expect(at("2026-10-20T08:00:00Z").status).toBe("pending");
    expect(at("2026-10-20T08:00:00Z", { habit_status: "done" }).status).toBe("done");
    expect(at("2026-10-20T08:00:00Z", { habit_status: "missed" }).status).toBe("missed");
  });
  it("un titre qui n'est pas du sport n'est jamais prévu", () => {
    expect(plannedSessions({ rules: [], exceptions: [], logs: [], workouts: [], now, back: 7, oneoffs: [{ ...run, title: "Dentiste" }] })).toEqual([]);
  });
});
