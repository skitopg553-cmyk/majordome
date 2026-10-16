import { describe, expect, it } from "vitest";
import { weekSummary } from "./mirror";

// Données FICTIVES : semaine du lundi 12 au dimanche 18 octobre 2026, on est jeudi 15 à 20 h.
const now = new Date("2026-10-15T20:00:00+02:00");
const input = {
  tasks: [
    { status: "done", due_at: "2026-10-13T09:00:00+02:00", done_at: "2026-10-13T10:00:00+02:00" },
    { status: "done", due_at: null, done_at: "2026-10-15T18:00:00+02:00" },
    { status: "done", due_at: null, done_at: "2026-10-09T18:00:00+02:00" }, // semaine d'avant
    { status: "todo", due_at: "2026-10-14T09:00:00+02:00", done_at: null }, // en retard
    { status: "todo", due_at: "2026-10-17T09:00:00+02:00", done_at: null }, // pas encore en retard
  ],
  transactions: [
    { date: "2026-10-12", label: "Carrefour", amount: -40, category: "Courses" },
    { date: "2026-10-13", label: "Uber Eats", amount: -25.5, category: "Restaurants" },
    { date: "2026-10-14", label: "Lidl", amount: -18, category: "Courses" },
    { date: "2026-10-14", label: "Livret A", amount: -100, category: "Épargne" },
    { date: "2026-10-15", label: "Client", amount: 300, category: "Revenu" },
    { date: "2026-10-05", label: "Ancien", amount: -999, category: "Shopping" },
  ],
  workouts: [
    { date: "2026-10-12", kind: "Salle", minutes: 60 },
    { date: "2026-10-12", kind: "Footing", minutes: 20 },
    { date: "2026-10-14", kind: "Padel", minutes: 90 },
  ],
};

describe("weekSummary", () => {
  it("résume la semaine en cours uniquement", () => {
    expect(weekSummary(input, now)).toEqual({
      from: "2026-10-12",
      to: "2026-10-18",
      tasksDone: 2,
      tasksLate: 1,
      spent: 83.5,
      income: 300,
      topCategory: { category: "Courses", spent: 58 },
      sessions: 3,
      activeDays: 2,
    });
  });
  it("semaine vide : des zéros, pas de catégorie inventée", () => {
    const s = weekSummary({ tasks: [], transactions: [], workouts: [] }, now);
    expect(s.tasksDone + s.spent + s.sessions).toBe(0);
    expect(s.topCategory).toBeNull();
  });
});

import { mirrorFacts, noteIsGrounded, weekMirror } from "./mirror";

describe("weekMirror (miroir réel)", () => {
  const more = {
    ...input,
    transactions: [...input.transactions, { date: "2026-10-06", label: "Resto", amount: -50, category: "Restaurants" }, { date: "2026-10-07", label: "Lidl", amount: -20, category: "Courses" }],
    sleeps: [{ date: "2026-10-13", hours: 7 }, { date: "2026-10-14", hours: 6 }, { date: "2026-10-05", hours: 3 }],
    meals: [{ date: "2026-10-13", kcal: 600 }, { date: "2026-10-13", kcal: 1200 }, { date: "2026-10-14", kcal: 1000 }],
  };
  it("compare à la semaine d'avant, moyennes sur les jours renseignés seulement", () => {
    const m = weekMirror(more, now);
    expect(m).toMatchObject({ spent: 83.5, spentPrev: 1069, spentDeltaPct: -92, sleepAvg: 6.5, nights: 2, kcalAvg: 1400, mealDays: 2 });
  });
  it("sans données : null, pas de zéro inventé", () => {
    const m = weekMirror({ ...input, transactions: [] }, now);
    expect(m).toMatchObject({ spentDeltaPct: null, sleepAvg: null, kcalAvg: null, nights: 0 });
    expect(mirrorFacts(m).join(" ")).not.toMatch(/Sommeil|Repas/);
  });
  it("garde-fou : refuse une phrase qui cite un chiffre absent des faits", () => {
    const m = weekMirror(more, now);
    expect(noteIsGrounded("Tu as dépensé 83,5 € et fait 3 séances, bravo.", m)).toBe(true);
    expect(noteIsGrounded("Tu as dépensé 120 € cette semaine.", m)).toBe(false);
    expect(noteIsGrounded("Belle semaine, continue comme ça.", m)).toBe(true);
  });
});
