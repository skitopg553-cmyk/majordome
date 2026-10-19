import { describe, expect, it } from "vitest";
import { cleanTitle, eventsOn, layoutDay, normTitle, overlaps, refuseTitle, remindersFor, resolveDay } from "./calendar";
import type { StoredRule } from "./recurrence";

const NOW = new Date("2026-10-19T08:00:00Z"); // lundi 19 octobre 2026, 10 h à Paris

describe("titres courts (constat du 19/10)", () => {
  it.each([
    ["Cours le lundi après-midi", "Cours"],
    ["Cours lundi", "Cours"],
    ["Cours le mardi", "Cours"],
    ["Travailler au Otacos le vendredi", "Travailler au Otacos"],
    ["Boxe anglaise le mardi", "Boxe anglaise"],
    ["Salle de muscu vendredi", "Salle de muscu"],
    ["cours tous les lundis matin", "Cours"],
    ["Restaurant avec Arthur", "Restaurant avec Arthur"],
    ["Lundi", "Lundi"],
  ])("%s → %s", (a, b) => expect(cleanTitle(a)).toBe(b));
  it("même clé pour les doublons du 19/10", () => {
    expect(normTitle("Cours le lundi")).toBe(normTitle("Cours lundi"));
    expect(normTitle("Travailler au Otacos le vendredi")).toBe(normTitle("travailler au otacos"));
    expect(normTitle("Le cours")).toBe("cours");
    expect(normTitle("Rendez-vous chez le dentiste")).toBe(normTitle("dentiste"));
  });
  it("« Fin de cours », « Reprise », « Pause » refusés ; « Pause déjeuner » accepté", () => {
    expect(refuseTitle("Fin de cours le lundi")).toMatch(/heure/);
    expect(refuseTitle("Reprise le mercredi")).toMatch(/heure/);
    expect(refuseTitle("Pause lundi")).toMatch(/pause/i);
    expect(refuseTitle("Pause déjeuner")).toBeNull();
    expect(refuseTitle("Cours")).toBeNull();
  });
});

describe("resolveDay : le code calcule les dates", () => {
  it.each([
    [undefined, "2026-10-19"],
    ["aujourd'hui", "2026-10-19"],
    ["ce soir", "2026-10-19"],
    ["demain", "2026-10-20"],
    ["après-demain", "2026-10-21"],
    ["jeudi", "2026-10-22"],
    ["lundi", "2026-10-19"],
    ["lundi prochain", "2026-10-26"],
    ["dimanche", "2026-10-25"],
    ["22 octobre", "2026-10-22"],
    ["jeudi 22 octobre", "2026-10-22"],
    ["1er novembre", "2026-11-01"],
    ["22/10", "2026-10-22"],
    ["2026-12-24", "2026-12-24"],
    ["5 janvier", "2027-01-05"],
  ])("%s", (v, out) => expect(resolveDay(v, NOW)).toEqual({ ok: true, value: out }));
  it("refuse l'incompréhensible", () => {
    expect(resolveDay("un jour", NOW).ok).toBe(false);
    expect(resolveDay("31/02", NOW).ok).toBe(false);
  });
});

describe("chevauchements et mise en page", () => {
  it("overlaps", () => {
    expect(overlaps({ start: "09:00", end: "12:00" }, { start: "11:00", end: "13:00" })).toBe(true);
    expect(overlaps({ start: "09:00", end: "12:00" }, { start: "12:00", end: "13:00" })).toBe(false); // bout à bout
  });
  it("pavés côte à côte seulement quand ils se chevauchent", () => {
    const l = layoutDay([
      { key: "a", start: "09:00", end: "12:00" },
      { key: "b", start: "10:00", end: "11:00" },
      { key: "c", start: "10:30", end: "13:00" },
      { key: "d", start: "14:00", end: "15:00" },
    ]);
    expect(l.get("a")).toEqual({ col: 0, cols: 3 });
    expect(l.get("b")).toEqual({ col: 1, cols: 3 });
    expect(l.get("c")).toEqual({ col: 2, cols: 3 });
    expect(l.get("d")).toEqual({ col: 0, cols: 1 });
  });
  it("une colonne libérée est réutilisée", () => {
    const l = layoutDay([
      { key: "a", start: "09:00", end: "10:00" },
      { key: "b", start: "09:30", end: "11:00" },
      { key: "c", start: "10:00", end: "10:30" },
    ]);
    expect(l.get("c")).toEqual({ col: 0, cols: 2 });
  });
});

describe("eventsOn / remindersFor : une seule vérité", () => {
  const rule: StoredRule = { id: 1, title: "Cours", kind: "weekly", weekday: 1, days: "1,2", month_day: null, at_time: "09:00", end_time: "12:00", habit: 0, last_generated: null, created_at: "2026-10-01T00:00:00Z" };
  const tasks = [
    { id: 1, title: "Dentiste", due_at: "2026-10-22T13:00:00Z", end_at: "2026-10-22T14:00:00Z", status: "todo" as const },
    { id: 2, title: "Sans fin", due_at: "2026-10-19T16:30:00Z", end_at: null, status: "todo" as const },
    { id: 3, title: "Poubelles", due_at: null, status: "todo" as const },
    { id: 4, title: "Pain", due_at: "2026-10-19T22:00:00Z", status: "todo" as const }, // mardi 20, minuit Paris = sans heure
    { id: 5, title: "En retard", due_at: "2026-10-17T22:00:00Z", status: "todo" as const },
  ];
  it("pavés : ponctuels et récurrents, fin par défaut 1 h ; pense-bêtes jamais dans la grille", () => {
    const mon = eventsOn("2026-10-19", tasks, [rule], []);
    expect(mon.map((e) => [e.title, e.start, e.end, e.recurring])).toEqual([["Cours", "09:00", "12:00", true], ["Sans fin", "18:30", "19:30", false]]);
    expect(eventsOn("2026-10-22", tasks, [rule], []).map((e) => [e.title, e.start, e.end])).toEqual([["Dentiste", "15:00", "16:00"]]);
    expect(eventsOn("2026-10-20", tasks, [rule], []).map((e) => e.title)).toEqual(["Cours"]);
  });
  it("pense-bêtes : du jour ; aujourd'hui = aussi en retard et sans date", () => {
    expect(remindersFor("2026-10-19", tasks, "2026-10-19").map((t) => t.title)).toEqual(["Poubelles", "En retard"]);
    expect(remindersFor("2026-10-20", tasks, "2026-10-19").map((t) => t.title)).toEqual(["Pain"]);
  });
});
