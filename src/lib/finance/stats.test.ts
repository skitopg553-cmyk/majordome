import { describe, expect, it } from "vitest";
import { goalProgress, isUnusual, median, monthTotals, spendingByCategory, unusualExpenses, type Tx } from "./stats";

const tx = (id: number, date: string, amount: number, category = "Courses", label = "x"): Tx => ({ id, date, amount, category, label });

const txs: Tx[] = [
  tx(1, "2026-10-02", 2350, "Revenu"),
  tx(2, "2026-10-03", -40),
  tx(3, "2026-10-05", -30),
  tx(4, "2026-10-06", -86.4, "Transport"),
  tx(5, "2026-10-07", -200, "Épargne"),
  tx(6, "2026-09-28", -999), // autre mois
];

describe("monthTotals", () => {
  it("additionne dépenses et revenus du mois, sans compter l'épargne", () => {
    expect(monthTotals(txs, "2026-10")).toEqual({ spent: 156.4, income: 2350 });
  });
  it("arrondit au centime (pas d'erreur de virgule flottante)", () => {
    expect(monthTotals([tx(1, "2026-10-01", -0.1), tx(2, "2026-10-01", -0.2)], "2026-10").spent).toBe(0.3);
  });
});

describe("spendingByCategory", () => {
  it("regroupe, compare au budget et trie par montant", () => {
    expect(spendingByCategory(txs, "2026-10", [{ category: "Courses", limit: 60 }, { category: "Loisirs", limit: 50 }])).toEqual([
      { category: "Transport", spent: 86.4, limit: null, over: false },
      { category: "Courses", spent: 70, limit: 60, over: true },
      { category: "Loisirs", spent: 0, limit: 50, over: false },
    ]);
  });
});

describe("median", () => {
  it("impair, pair, vide", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBe(0);
  });
});

describe("dépense inhabituelle (> 2× la médiane de la catégorie sur 90 jours)", () => {
  const history = [tx(1, "2026-08-01", -30), tx(2, "2026-09-01", -40), tx(3, "2026-09-15", -50), tx(4, "2026-10-01", -35)]; // médiane 37,5
  it("signale au-delà de 2× la médiane", () => {
    const big = tx(10, "2026-10-10", -80);
    expect(isUnusual(big, [...history, big])).toBe(true);
  });
  it("ne signale pas pile à 2× ni en dessous", () => {
    const edge = tx(11, "2026-10-10", -75);
    expect(isUnusual(edge, [...history, edge])).toBe(false);
  });
  it("ignore les autres catégories, les revenus et ce qui a plus de 90 jours", () => {
    const old = [tx(20, "2026-06-01", -1), tx(21, "2026-06-02", -1), tx(22, "2026-06-03", -1)];
    const t = tx(12, "2026-10-10", -80);
    expect(isUnusual(t, [...old, t])).toBe(false); // trop vieux : moins de 3 comparaisons
    expect(isUnusual(tx(13, "2026-10-10", -80, "Loisirs"), history)).toBe(false);
    expect(isUnusual(tx(14, "2026-10-10", 5000, "Revenu"), history)).toBe(false);
  });
  it("ne juge pas avec moins de 3 dépenses de comparaison", () => {
    const t = tx(15, "2026-10-10", -500);
    expect(isUnusual(t, [tx(1, "2026-10-01", -10), tx(2, "2026-10-02", -10), t])).toBe(false);
  });
  it("liste celles du mois, plus récentes d'abord", () => {
    const a = tx(30, "2026-10-08", -90);
    const b = tx(31, "2026-10-12", -100);
    expect(unusualExpenses([...history, a, b], "2026-10").map((t) => t.id)).toEqual([31, 30]);
  });
});

describe("goalProgress", () => {
  it("borne entre 0 et 100", () => {
    expect(goalProgress(1850, 4000)).toBe(46);
    expect(goalProgress(5000, 4000)).toBe(100);
    expect(goalProgress(10, 0)).toBe(0);
  });
});
