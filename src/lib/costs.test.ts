import { describe, expect, it } from "vitest";
import { summarizeCosts, usd } from "./costs";

const now = new Date("2026-10-16T14:00:00+02:00"); // vendredi 16 octobre, Paris
const row = (model: string, cost: number | string | null, at: string) => ({ model, cost_usd: cost, created_at: at });

describe("summarizeCosts", () => {
  const rows = [
    row("claude-sonnet-5-5", 0.02, "2026-10-16T08:00:00+02:00"), // aujourd'hui
    row("claude-sonnet-5-5", 0.03, "2026-10-16T09:00:00+02:00"), // aujourd'hui
    row("claude-haiku-5-5", 0.001, "2026-10-16T09:30:00+02:00"), // aujourd'hui
    row("claude-sonnet-5-5", 0.1, "2026-10-05T12:00:00+02:00"), // ce mois, pas aujourd'hui
    row("claude-sonnet-5-5", 9, "2026-09-30T12:00:00+02:00"), // mois dernier : ignoré
  ];
  it("coût du jour, du mois et par modèle (le plus cher d'abord)", () => {
    const s = summarizeCosts(rows, now);
    expect(s.today).toEqual({ cost: 0.051, calls: 3 });
    expect(s.month).toEqual({ cost: 0.151, calls: 4 });
    expect(s.byModel).toEqual([
      { model: "claude-sonnet-5-5", cost: 0.15, calls: 3 },
      { model: "claude-haiku-5-5", cost: 0.001, calls: 1 },
    ]);
  });
  it("les jours et mois suivent l'heure de PARIS, pas l'UTC", () => {
    // 30 sept. 23:30 UTC = 1er octobre 01:30 à Paris : compte pour octobre.
    expect(summarizeCosts([row("m", 1, "2026-09-30T23:30:00Z")], now).month.cost).toBe(1);
    // 16 oct. 23:30 Paris (21:30 UTC) : toujours « aujourd'hui » ; 15 oct. 23:30 UTC = 16 oct. 01:30 Paris : aussi aujourd'hui.
    expect(summarizeCosts([row("m", 2, "2026-10-15T23:30:00Z")], now).today.cost).toBe(2);
  });
  it("montants en texte (numeric de Postgres), nuls ou absents : pas d'erreur de calcul", () => {
    const s = summarizeCosts([row("a", "0.10", "2026-10-16T10:00:00+02:00"), row("a", "0.20", "2026-10-16T11:00:00+02:00"), row("a", null, "2026-10-16T12:00:00+02:00")], now);
    expect(s.today.cost).toBe(0.3); // 0,1 + 0,2 = 0,3 (pas 0,30000000000000004)
  });
  it("signale les appels sans prix connu (coût 0) : le total est alors sous-estimé", () => {
    const s = summarizeCosts([row("gpt-4o-mini", 0, "2026-10-16T10:00:00+02:00"), row("gpt-4o-mini", 0, "2026-10-16T11:00:00+02:00"), row("claude", 0.5, "2026-10-16T12:00:00+02:00")], now);
    expect(s.unpriced).toBe(2);
  });
  it("aucune donnée : des zéros", () => {
    expect(summarizeCosts([], now)).toEqual({ today: { cost: 0, calls: 0 }, month: { cost: 0, calls: 0 }, byModel: [], unpriced: 0 });
  });
});

describe("usd", () => {
  it("formate de 0 à plusieurs dollars", () => {
    expect([0, 0.004, 0.042, 0.5, 3.2, 12].map(usd)).toEqual(["$0", "<$0.01", "$0.042", "$0.500", "$3.20", "$12.00"]);
  });
});
