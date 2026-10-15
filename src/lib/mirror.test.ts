import { describe, expect, it } from "vitest";
import { weeklyPrompt, weekSummary } from "./mirror";

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

describe("weeklyPrompt", () => {
  it("donne à l'IA uniquement les vrais chiffres et le ton attendu", () => {
    const p = weeklyPrompt(weekSummary(input, now));
    expect(p).toContain("Tâches faites : 2");
    expect(p).toContain("Dépenses : 83.5 €");
    expect(p).toContain("surtout en Courses (58 €)");
    expect(p).toMatch(/Jamais culpabilisant/);
    expect(p).toMatch(/N'invente aucun chiffre/);
  });
});
