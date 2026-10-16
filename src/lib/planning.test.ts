import { describe, expect, it } from "vitest";
import { dotsFor, hasTime, hourRange, parisHM, planDay, swipeDirection, weekOf } from "./planning";

type Task = { id: number; due_at: string | null; status: "todo" | "done" };
const t = (id: number, due_at: string | null, status: "todo" | "done" = "todo"): Task => ({ id, due_at, status });
const now = new Date("2026-10-16T10:30:00+02:00"); // vendredi

describe("heure de Paris", () => {
  it("parisHM et hasTime (00:00 = sans heure)", () => {
    expect(parisHM("2026-10-16T09:05:00+02:00")).toEqual({ h: 9, m: 5 });
    expect(parisHM("2026-10-16T22:30:00Z")).toEqual({ h: 0, m: 30 }); // minuit passé à Paris
    expect(hasTime("2026-10-16T00:00:00+02:00")).toBe(false);
    expect(hasTime("2026-10-16T00:01:00+02:00")).toBe(true);
    expect(hasTime("2026-10-15T22:00:00Z")).toBe(false); // = 00:00 le 16 à Paris
  });
});

describe("planDay", () => {
  const tasks = [
    t(1, "2026-10-16T14:00:00+02:00"),
    t(2, "2026-10-16T09:30:00+02:00"),
    t(3, "2026-10-16T09:00:00+02:00"),
    t(4, "2026-10-16T00:00:00+02:00"), // toute la journée
    t(5, null), // sans date
    t(6, "2026-10-14T10:00:00+02:00"), // en retard
    t(7, "2026-10-17T11:00:00+02:00"), // demain
    t(8, "2026-10-14T10:00:00+02:00", "done"), // faite : jamais en retard
    t(9, null, "done"),
    t(10, "2026-10-16T08:00:00+02:00", "done"), // faite aujourd'hui : reste à sa place
  ];
  it("aujourd'hui : en retard, sans date, sans heure, et par heure triées", () => {
    const p = planDay(tasks, "2026-10-16", now);
    expect(p.late.map((x) => x.id)).toEqual([6]);
    expect(p.undated.map((x) => x.id)).toEqual([5]);
    expect(p.allDay.map((x) => x.id)).toEqual([4]);
    expect([...p.byHour.keys()].sort((a, b) => a - b)).toEqual([8, 9, 14]);
    expect(p.byHour.get(9)!.map((x) => x.id)).toEqual([3, 2]);
  });
  it("un autre jour : ni retard ni sans date", () => {
    const p = planDay(tasks, "2026-10-17", now);
    expect(p.late).toEqual([]);
    expect(p.undated).toEqual([]);
    expect(p.byHour.get(11)!.map((x) => x.id)).toEqual([7]);
  });
  it("un jour sans rien", () => {
    const p = planDay(tasks, "2026-10-20", now);
    expect(p.allDay).toEqual([]);
    expect(p.byHour.size).toBe(0);
  });
  it("le jour est celui de Paris, pas de l'UTC", () => {
    const late = t(1, "2026-10-16T23:30:00+02:00"); // 21:30 UTC : encore le 16 à Paris
    expect(planDay([late], "2026-10-16", now).byHour.get(23)).toHaveLength(1);
    const early = t(2, "2026-10-17T00:30:00+02:00"); // 22:30 UTC le 16 : c'est le 17 à Paris
    expect(planDay([early], "2026-10-16", now).byHour.size).toBe(0);
    expect(planDay([early], "2026-10-17", now).byHour.get(0)).toHaveLength(1);
  });
});

describe("hourRange, weekOf, dotsFor, swipeDirection", () => {
  it("plage 7–22 élargie par les tâches et par l'heure actuelle", () => {
    expect(hourRange([])).toEqual({ start: 7, end: 22 });
    expect(hourRange([5, 23])).toEqual({ start: 5, end: 23 });
    expect(hourRange([9], { h: 6 })).toEqual({ start: 6, end: 22 });
  });
  it("la semaine commence le lundi", () => {
    expect(weekOf("2026-10-16")).toEqual(["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18"]);
    expect(weekOf("2026-10-18")[0]).toBe("2026-10-12"); // dimanche
    expect(weekOf("2026-10-12")[6]).toBe("2026-10-18"); // lundi
    expect(weekOf("2026-10-28")).toContain("2026-10-26"); // traverse le changement d'heure du 25 octobre sans décalage
  });
  it("points : tâches à faire du jour, 3 au maximum", () => {
    const list = [t(1, "2026-10-16T09:00:00+02:00"), t(2, "2026-10-16T10:00:00+02:00"), t(3, "2026-10-16T11:00:00+02:00"), t(4, "2026-10-16T12:00:00+02:00"), t(5, "2026-10-16T13:00:00+02:00", "done"), t(6, null)];
    expect(dotsFor(list, "2026-10-16")).toBe(3);
    expect(dotsFor(list.slice(0, 2), "2026-10-16")).toBe(2);
    expect(dotsFor(list, "2026-10-17")).toBe(0);
  });
  it("glissement : franc et horizontal seulement", () => {
    expect(swipeDirection(-120, 10)).toBe(1);
    expect(swipeDirection(120, -10)).toBe(-1);
    expect(swipeDirection(-40, 0)).toBe(0); // trop court
    expect(swipeDirection(-100, 90)).toBe(0); // surtout vertical : c'est un défilement
  });
});
