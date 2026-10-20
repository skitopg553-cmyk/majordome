import { describe, expect, it } from "vitest";
import { clampSessionSeconds, DEFAULT_MAX_MINUTES_PER_DAY, maxSecondsPerDay, realtimeCostUsd, REALTIME_INSTRUCTIONS, remainingSeconds, usdPerMinute } from "./realtime";

describe("plafond de minutes par jour (REALTIME_MAX_MINUTES_PER_DAY)", () => {
  it("10 minutes par défaut ; valeur valide acceptée ; absurde ignorée ; 0 coupe la fonction", () => {
    expect(DEFAULT_MAX_MINUTES_PER_DAY).toBe(10);
    expect(maxSecondsPerDay(undefined)).toBe(600);
    expect(maxSecondsPerDay("")).toBe(600);
    expect(maxSecondsPerDay("abc")).toBe(600);
    expect(maxSecondsPerDay("-3")).toBe(600);
    expect(maxSecondsPerDay("5")).toBe(300);
    expect(maxSecondsPerDay("0")).toBe(0);
  });
  it("secondes restantes : le plafond moins ce qui est déjà utilisé, rien sous 10 s", () => {
    expect(remainingSeconds(0, 600)).toBe(600);
    expect(remainingSeconds(125_000, 600)).toBe(475);
    expect(remainingSeconds(595_000, 600)).toBe(0); // 5 s : pas la peine
    expect(remainingSeconds(600_000, 600)).toBe(0);
    expect(remainingSeconds(900_000, 600)).toBe(0);
    expect(remainingSeconds(0, 0)).toBe(0); // fonction coupée
  });
});

describe("coût estimé", () => {
  it("proportionnel à la durée ; la valeur par défaut est prudente", () => {
    expect(usdPerMinute(undefined)).toBe(0.2);
    expect(usdPerMinute("0.05")).toBe(0.05);
    expect(realtimeCostUsd(60, 0.2)).toBeCloseTo(0.2, 6);
    expect(realtimeCostUsd(30, 0.2)).toBeCloseTo(0.1, 6);
    expect(realtimeCostUsd(600, 0.2)).toBeCloseTo(2, 6); // le plafond du jour par défaut
    expect(realtimeCostUsd(-5, 0.2)).toBe(0);
  });
});

describe("durée rapportée par l'écran : jamais crue aveuglément", () => {
  it("bornée entre 0 et ce qui était autorisé + 15 s", () => {
    expect(clampSessionSeconds(42.4, 600)).toBe(42);
    expect(clampSessionSeconds(-10, 600)).toBe(0);
    expect(clampSessionSeconds(99999, 600)).toBe(615);
    expect(clampSessionSeconds("beaucoup", 600)).toBe(0);
    expect(clampSessionSeconds(NaN, 600)).toBe(0);
  });
});

describe("personnalité de la session", () => {
  it("vouvoiement, « Monsieur », pas d'accès aux données", () => {
    expect(REALTIME_INSTRUCTIONS).toMatch(/vouvoies/);
    expect(REALTIME_INSTRUCTIONS).toMatch(/Monsieur/);
    expect(REALTIME_INSTRUCTIONS).toMatch(/pas accès/);
  });
});
