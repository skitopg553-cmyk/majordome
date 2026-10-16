import { describe, expect, it } from "vitest";
import { dueAtFor, dueToday, occursOn, parseAtTime, parseRecurrence, ruleLabel, type StoredRule } from "./recurrence";

describe("parseRecurrence : la phrase est comprise en code", () => {
  it.each([
    ["tous les lundis", { kind: "weekly", weekday: 1, month_day: null }],
    ["Chaque vendredi", { kind: "weekly", weekday: 5, month_day: null }],
    ["toutes les dimanches", { kind: "weekly", weekday: 7, month_day: null }],
    ["chaque jour", { kind: "daily", weekday: null, month_day: null }],
    ["Tous les jours", { kind: "daily", weekday: null, month_day: null }],
    ["tous les mois le 5", { kind: "monthly", weekday: null, month_day: 5 }],
    ["chaque mois le 12", { kind: "monthly", weekday: null, month_day: 12 }],
  ])("%s", (text, value) => expect(parseRecurrence(text)).toEqual({ ok: true, value }));
  it("refuse ce qui n'est pas clair", () => {
    for (const bad of ["demain", "le lundi", "tous les mois", "tous les mois le 40", "", null, 12]) expect(parseRecurrence(bad)).toMatchObject({ ok: false });
  });
});

describe("occursOn", () => {
  it("quotidien, hebdomadaire (vendredi 2026-10-16), mensuel", () => {
    expect(occursOn({ kind: "daily", weekday: null, month_day: null }, "2026-10-16")).toBe(true);
    const fri = { kind: "weekly" as const, weekday: 5, month_day: null };
    expect(occursOn(fri, "2026-10-16")).toBe(true);
    expect(occursOn(fri, "2026-10-17")).toBe(false);
    const sun = { ...fri, weekday: 7 };
    expect(occursOn(sun, "2026-10-18")).toBe(true);
    expect(occursOn({ kind: "monthly", weekday: null, month_day: 5 }, "2026-11-05")).toBe(true);
    expect(occursOn({ kind: "monthly", weekday: null, month_day: 5 }, "2026-11-06")).toBe(false);
  });
  it("« le 31 » tombe le dernier jour des mois courts", () => {
    const r = { kind: "monthly" as const, weekday: null, month_day: 31 };
    expect(occursOn(r, "2026-02-28")).toBe(true);
    expect(occursOn(r, "2026-04-30")).toBe(true);
    expect(occursOn(r, "2026-04-29")).toBe(false);
    expect(occursOn(r, "2028-02-29")).toBe(true); // année bissextile
  });
});

describe("occurrence du jour", () => {
  it("heure facultative : sans heure = minuit (tâche), avec = agenda", () => {
    expect(dueAtFor(null, "2026-10-16")).toBe("2026-10-15T22:00:00.000Z");
    expect(dueAtFor("09:30", "2026-10-16")).toBe("2026-10-16T07:30:00.000Z");
    expect(parseAtTime("9:30")).toEqual({ ok: true, value: "09:30" });
    expect(parseAtTime(undefined)).toEqual({ ok: true, value: null });
    expect(parseAtTime("25:00").ok).toBe(false);
  });
  it("une règle ne crée qu'une tâche par jour", () => {
    const base = { title: "x", at_time: null, kind: "daily" as const, weekday: null, month_day: null };
    const rules: StoredRule[] = [{ ...base, id: 1, last_generated: "2026-10-15" }, { ...base, id: 2, last_generated: "2026-10-16" }, { ...base, id: 3, kind: "weekly", weekday: 1, last_generated: null }];
    expect(dueToday(rules, "2026-10-16").map((r) => r.id)).toEqual([1]); // 2 déjà fait, 3 tombe le lundi
  });
  it("libellé lisible", () => {
    expect(ruleLabel({ kind: "weekly", weekday: 1, month_day: null, at_time: "09:00" })).toBe("chaque lundi à 09:00");
    expect(ruleLabel({ kind: "monthly", weekday: null, month_day: 5 })).toBe("le 5 de chaque mois");
  });
});
