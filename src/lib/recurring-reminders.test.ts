import { describe, expect, it } from "vitest";
import { parseRecurrence, ruleLabel, type StoredRule } from "./recurrence";
import { checkedToday, dueReminders, ruleIdOf, virtualId } from "./recurring-reminders";

const rule = (o: Partial<StoredRule>): StoredRule => ({ id: 1, title: "Créatine", kind: "daily", weekday: null, month_day: null, at_time: null, last_generated: null, created_at: "2026-10-01T08:00:00Z", ...o });
const titles = (rules: StoredRule[], checks: { rule_id: number; day: string }[], today: string) => dueReminders(rules, checks, today).map((d) => d.title);

describe("remise à zéro chaque jour", () => {
  const creatine = rule({});
  it("« tous les jours » : visible, coché = disparu pour aujourd'hui, revenu le lendemain", () => {
    expect(titles([creatine], [], "2026-10-20")).toEqual(["Créatine"]);
    expect(titles([creatine], [{ rule_id: 1, day: "2026-10-20" }], "2026-10-20")).toEqual([]);
    expect(titles([creatine], [{ rule_id: 1, day: "2026-10-20" }], "2026-10-21")).toEqual(["Créatine"]);
  });
  it("jamais de cumul : pas fait hier, une seule ligne aujourd'hui", () => {
    expect(dueReminders([creatine], [], "2026-10-20")).toHaveLength(1);
    expect(dueReminders([creatine], [], "2026-10-25")).toHaveLength(1);
  });
  it("certains jours : seulement ces jours-là (lundi et jeudi)", () => {
    const poubelles = rule({ id: 2, title: "Poubelles", kind: "weekly", weekday: 1, days: "1,4" });
    expect(titles([poubelles], [], "2026-10-19")).toEqual(["Poubelles"]); // lundi
    expect(titles([poubelles], [], "2026-10-20")).toEqual([]); // mardi
    expect(titles([poubelles], [], "2026-10-22")).toEqual(["Poubelles"]); // jeudi
    expect(titles([poubelles], [{ rule_id: 2, day: "2026-10-19" }], "2026-10-19")).toEqual([]);
  });
  it("pas avant le jour de sa création, ni pour une règle avec heure (un créneau)", () => {
    expect(titles([rule({ created_at: "2026-10-22T08:00:00Z" })], [], "2026-10-20")).toEqual([]);
    expect(titles([rule({ at_time: "18:30" })], [], "2026-10-20")).toEqual([]);
  });
});

describe("« X fois par semaine » : compteur hebdomadaire", () => {
  const aspi = rule({ id: 3, title: "Aspirateur", per_week: 2 });
  const checks = (...days: string[]) => days.map((day) => ({ rule_id: 3, day }));
  it("visible avec sa progression tant que le compte n'est pas atteint", () => {
    expect(dueReminders([aspi], [], "2026-10-20")[0].progress).toEqual({ done: 0, of: 2 });
    expect(dueReminders([aspi], checks("2026-10-19"), "2026-10-21")[0].progress).toEqual({ done: 1, of: 2 });
  });
  it("coché = fait pour aujourd'hui (disparu), revenu demain s'il en manque", () => {
    expect(titles([aspi], checks("2026-10-20"), "2026-10-20")).toEqual([]);
    expect(dueReminders([aspi], checks("2026-10-20"), "2026-10-21")[0].progress).toEqual({ done: 1, of: 2 });
  });
  it("compte atteint : plus rien jusqu'à la fin de la semaine", () => {
    const done = checks("2026-10-19", "2026-10-20");
    for (const d of ["2026-10-21", "2026-10-22", "2026-10-25"]) expect(titles([aspi], done, d)).toEqual([]); // jeudi, vendredi… dimanche
  });
  it("changement de semaine : le lundi remet le compteur à zéro", () => {
    const done = checks("2026-10-19", "2026-10-20"); // semaine du 19 au 25 octobre
    expect(titles([aspi], done, "2026-10-25")).toEqual([]); // dimanche : atteint
    expect(dueReminders([aspi], done, "2026-10-26")[0].progress).toEqual({ done: 0, of: 2 }); // lundi suivant
  });
});

describe("identifiants virtuels", () => {
  it("jamais confondus avec un vrai identifiant de tâche", () => {
    expect(ruleIdOf(virtualId(7))).toBe(7);
    expect(ruleIdOf(42)).toBeNull();
    expect(ruleIdOf(-1)).toBeNull();
  });
});

describe("phrases comprises en code", () => {
  it.each([
    ["deux fois par semaine", { kind: "daily", weekday: null, month_day: null, per_week: 2 }],
    ["3 fois par semaine", { kind: "daily", weekday: null, month_day: null, per_week: 3 }],
    ["une fois par semaine", { kind: "daily", weekday: null, month_day: null, per_week: 1 }],
    ["tous les lundis et jeudis", { kind: "weekly", weekday: 1, month_day: null, days: "1,4" }],
    ["chaque mardi et vendredi", { kind: "weekly", weekday: 2, month_day: null, days: "2,5" }],
    ["en semaine", { kind: "weekly", weekday: 1, month_day: null, days: "1,2,3,4,5" }],
    ["le week-end", { kind: "weekly", weekday: 6, month_day: null, days: "6,7" }],
    ["tous les jours", { kind: "daily", weekday: null, month_day: null }],
    ["tous les lundis", { kind: "weekly", weekday: 1, month_day: null }],
  ])("%s", (text, value) => expect(parseRecurrence(text)).toEqual({ ok: true, value }));
  it("refuse 0 ou 9 fois par semaine", () => {
    expect(parseRecurrence("0 fois par semaine")).toMatchObject({ ok: false });
    expect(parseRecurrence("9 fois par semaine")).toMatchObject({ ok: false });
  });
  it("libellés lisibles", () => {
    expect(ruleLabel({ kind: "daily", weekday: null, month_day: null, per_week: 2 })).toBe("2 fois par semaine");
    expect(ruleLabel({ kind: "weekly", weekday: 1, month_day: null, days: "1,4" })).toBe("chaque lundi et jeudi");
    expect(ruleLabel({ kind: "weekly", weekday: 1, month_day: null, days: "1,2,3,4,5" })).toBe("en semaine");
  });
});

describe("déjà cochés aujourd'hui (pour les rouvrir)", () => {
  it("seulement ceux cochés aujourd'hui, avec la progression de la semaine pour « X fois par semaine »", () => {
    const rules = [rule({ id: 1, title: "Créatine" }), rule({ id: 3, title: "Aspirateur", per_week: 2 }), rule({ id: 4, title: "Cours", at_time: "09:00" })];
    const checks = [{ rule_id: 1, day: "2026-10-20" }, { rule_id: 3, day: "2026-10-19" }, { rule_id: 3, day: "2026-10-20" }, { rule_id: 4, day: "2026-10-20" }];
    expect(checkedToday(rules, checks, "2026-10-20").map((d) => [d.title, d.progress])).toEqual([["Créatine", null], ["Aspirateur", { done: 2, of: 2 }]]);
    expect(checkedToday(rules, checks, "2026-10-21")).toEqual([]);
  });
});
