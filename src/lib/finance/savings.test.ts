import { describe, expect, it } from "vitest";
import { goalAdvice, labelKey, matchGoal, monthsLeft, parseDueMonth, savingsCapacity, type Goal } from "./savings";
import type { Tx } from "./stats";

const goal = (label: string, extra: Partial<Goal> = {}): Goal => ({ id: 1, label, target: 3000, saved: 0, due_label: null, ...extra });

describe("matchGoal : nom dit à la voix → objectif", () => {
  const goals = [goal("Voiture", { id: 1 }), goal("Vacances été", { id: 2 }), goal("Vacances hiver", { id: 3 })];
  it("retrouve un nom avec article, casse ou accents différents", () => {
    expect(matchGoal(goals, "la voiture")).toMatchObject({ kind: "one", goal: { id: 1 } });
    expect(matchGoal(goals, "VOITURE")).toMatchObject({ kind: "one", goal: { id: 1 } });
    expect(matchGoal(goals, "vacances ete")).toMatchObject({ kind: "one", goal: { id: 2 } });
  });
  it("ambigu quand plusieurs objectifs correspondent, none quand aucun", () => {
    const r = matchGoal(goals, "vacances");
    expect(r.kind).toBe("ambiguous");
    expect(r.kind === "ambiguous" && r.candidates.map((g) => g.id)).toEqual([2, 3]);
    expect(matchGoal(goals, "moto")).toEqual({ kind: "none" });
    expect(matchGoal(goals, "  ")).toEqual({ kind: "none" });
  });
});

// Trois mois pleins (juillet, août, septembre 2026) ; on est le 16 octobre.
const LETTER: Record<string, string> = { "07": "Alpha", "08": "Bravo", "09": "Charlie" };
const month = (m: string): Tx[] => [
  { date: `${m}-01`, label: "SALAIRE ACME", amount: 2000, category: "Revenu" },
  { date: `${m}-03`, label: "LOYER", amount: -700, category: "Logement" },
  { date: `${m}-05`, label: "NETFLIX 05/" + m.slice(5), amount: -14, category: "Abonnements" },
  { date: `${m}-10`, label: "Courses " + LETTER[m.slice(5)], amount: -100, category: "Courses" },
  { date: `${m}-20`, label: "Resto " + LETTER[m.slice(5)], amount: -50, category: "Restaurants" },
  { date: `${m}-25`, label: "Virement épargne", amount: -200, category: "Épargne" },
];

describe("savingsCapacity", () => {
  it("revenus − charges fixes − variables (médiane) − 10 % de marge", () => {
    const txs = ["2026-07", "2026-08", "2026-09"].flatMap(month);
    const c = savingsCapacity(txs, "2026-10-16");
    expect(c).toMatchObject({ months: 3, income: 2000, fixed: 714, variable: 150, margin: 200, free: 936 });
  });
  it("ignore le mois en cours et les virements vers l'épargne", () => {
    const txs = [...["2026-08", "2026-09"].flatMap(month), { date: "2026-10-02", label: "Gros achat", amount: -5000, category: "Shopping" }];
    const c = savingsCapacity(txs, "2026-10-16");
    expect(c.months).toBe(2);
    expect(c.variable).toBe(150);
  });
  it("un libellé qui revient avec un montant très différent n'est PAS une charge fixe", () => {
    const txs: Tx[] = [
      { date: "2026-08-01", label: "Salaire", amount: 2000, category: "Revenu" },
      { date: "2026-09-01", label: "Salaire", amount: 2000, category: "Revenu" },
      { date: "2026-08-10", label: "Amazon", amount: -20, category: "Shopping" },
      { date: "2026-09-10", label: "Amazon", amount: -200, category: "Shopping" },
    ];
    const c = savingsCapacity(txs, "2026-10-16");
    expect(c.fixed).toBe(0);
    expect(c.variable).toBe(110); // médiane de 20 et 200
  });
  it("jamais négatif, et rien sans historique", () => {
    const poor: Tx[] = [
      { date: "2026-09-01", label: "Salaire", amount: 500, category: "Revenu" },
      { date: "2026-09-05", label: "Loyer", amount: -900, category: "Logement" },
    ];
    expect(savingsCapacity(poor, "2026-10-16").free).toBe(0);
    expect(savingsCapacity([], "2026-10-16")).toMatchObject({ months: 0, free: 0 });
  });
  it("labelKey ignore chiffres, dates et accents", () => {
    expect(labelKey("NETFLIX 12/10")).toBe(labelKey("Netflix 12/11"));
    expect(labelKey("Café  Léon 42")).toBe("cafe leon");
  });
});

describe("échéance d'un objectif", () => {
  it("lit un mois en français, avec ou sans année", () => {
    expect(parseDueMonth("Juin", "2026-10-16")).toBe("2027-06");
    expect(parseDueMonth("décembre", "2026-10-16")).toBe("2026-12");
    expect(parseDueMonth("Octobre", "2026-10-16")).toBe("2026-10");
    expect(parseDueMonth("août 2028", "2026-10-16")).toBe("2028-08");
    expect(parseDueMonth("bientôt", "2026-10-16")).toBeNull();
    expect(parseDueMonth(null, "2026-10-16")).toBeNull();
  });
  it("mois restants : au moins 1, null si passé", () => {
    expect(monthsLeft("2027-06", "2026-10-16")).toBe(8);
    expect(monthsLeft("2026-10", "2026-10-16")).toBe(1);
    expect(monthsLeft("2026-09", "2026-10-16")).toBeNull();
  });
});

describe("goalAdvice : une phrase simple", () => {
  const today = "2026-10-16";
  it("trop juste : mensualité, dispo, décalage ou économie", () => {
    // Reste 2000 €, jusqu'à décembre = 2 mois → 1000 €/mois ; 800 dispo → 3 mois au lieu de 2 → décale de 1 mois, ou réduis de 200 €.
    const a = goalAdvice(goal("Voiture", { target: 2500, saved: 500, due_label: "Décembre" }), 800, today);
    expect(a.needed).toBe(1000);
    expect(a.text).toBe("Voiture : 1000 €/mois nécessaires, 800 € dispo → décalez de 1 mois ou réduisez vos sorties de 200 €.");
  });
  it("tenable, atteint, sans date, date passée, rien de libre", () => {
    expect(goalAdvice(goal("Moto", { target: 1000, due_label: "Juin 2027" }), 500, today).text).toContain("tenable");
    expect(goalAdvice(goal("Moto", { target: 1000, saved: 1000 }), 0, today).text).toBe("Moto : objectif atteint.");
    expect(goalAdvice(goal("Moto", { due_label: null }), 100, today).needed).toBeNull();
    expect(goalAdvice(goal("Moto", { due_label: "Mars 2026" }), 100, today).text).toContain("date est passée");
    expect(goalAdvice(goal("Moto", { due_label: "Décembre" }), 0, today).text).toContain("rien de libre");
  });
});
