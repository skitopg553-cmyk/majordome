import { describe, expect, it } from "vitest";
import { dotsFor, hasTime, homeTasks, hourRange, isAgenda, parisHM, planDay, weekOf } from "./planning";

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

const tasks = [
  t(1, "2026-10-16T14:00:00+02:00"),
  t(2, "2026-10-16T09:30:00+02:00"),
  t(3, "2026-10-16T09:00:00+02:00"),
  t(4, "2026-10-16T00:00:00+02:00"), // sans heure = tâche
  t(5, null), // sans date = tâche
  t(6, "2026-10-14T10:00:00+02:00"), // agenda passé
  t(7, "2026-10-17T11:00:00+02:00"), // demain
  t(8, "2026-10-14T00:00:00+02:00"), // tâche en retard
  t(9, null, "done"),
  t(10, "2026-10-16T08:00:00+02:00", "done"), // agenda fait : reste à sa place
  t(11, "2026-10-18T00:00:00+02:00"), // tâche à venir
];

describe("agenda / tâche : la règle", () => {
  it("heure précise = agenda ; 00:00 ou sans date = tâche", () => {
    expect(isAgenda(t(1, "2026-10-16T14:00:00+02:00"))).toBe(true);
    expect(isAgenda(t(2, "2026-10-16T00:00:00+02:00"))).toBe(false);
    expect(isAgenda(t(3, null))).toBe(false);
  });
  it("la frise ne contient QUE de l'agenda, jamais une tâche", () => {
    const byHour = planDay(tasks, "2026-10-16");
    expect([...byHour.keys()].sort((a, b) => a - b)).toEqual([8, 9, 14]);
    expect(byHour.get(9)!.map((x) => x.id)).toEqual([3, 2]);
    expect([...byHour.values()].flat().map((x) => x.id)).not.toContain(4);
    expect([...byHour.values()].flat().map((x) => x.id)).not.toContain(5);
  });
  it("un autre jour, un jour vide, et le jour de Paris (pas de l'UTC)", () => {
    expect(planDay(tasks, "2026-10-17").get(11)!.map((x) => x.id)).toEqual([7]);
    expect(planDay(tasks, "2026-10-20").size).toBe(0);
    expect(planDay([t(1, "2026-10-16T23:30:00+02:00")], "2026-10-16").get(23)).toHaveLength(1);
    expect(planDay([t(2, "2026-10-17T00:30:00+02:00")], "2026-10-16").size).toBe(0);
  });
  it("l'Accueil : seulement les tâches à faire, en retard → aujourd'hui → sans date → à venir", () => {
    expect(homeTasks(tasks, now).map((x) => x.id)).toEqual([8, 4, 5, 11]);
  });
});

describe("hourRange, weekOf, dotsFor", () => {
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
    const list = [t(7, "2026-10-16T00:00:00+02:00"), t(1, "2026-10-16T09:00:00+02:00"), t(2, "2026-10-16T10:00:00+02:00"), t(3, "2026-10-16T11:00:00+02:00"), t(4, "2026-10-16T12:00:00+02:00"), t(5, "2026-10-16T13:00:00+02:00", "done"), t(6, null)];
    expect(dotsFor(list, "2026-10-16")).toBe(3);
    expect(dotsFor(list.slice(1, 3), "2026-10-16")).toBe(2);
    expect(dotsFor(list, "2026-10-17")).toBe(0);
  });
});
