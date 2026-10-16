import { describe, expect, it } from "vitest";
import { shouldSaveSnapshot } from "./snapshot";

describe("shouldSaveSnapshot", () => {
  const latest = { balance: 1000, asOf: "2026-10-10" };
  it("garde le premier solde", () => expect(shouldSaveSnapshot(null, { balance: 5, asOf: "2026-01-01" })).toBe(true));
  it("garde un solde plus récent", () => expect(shouldSaveSnapshot(latest, { balance: 1200, asOf: "2026-10-12" })).toBe(true));
  it("un vieux relevé n'écrase jamais un solde plus récent", () => expect(shouldSaveSnapshot(latest, { balance: 50, asOf: "2026-09-30" })).toBe(false));
  it("réimport du même relevé (même jour, même montant) : rien à faire", () => expect(shouldSaveSnapshot(latest, { ...latest })).toBe(false));
  it("même jour mais montant différent (relevé corrigé) : on garde", () => expect(shouldSaveSnapshot(latest, { balance: 1010.5, asOf: "2026-10-10" })).toBe(true));
});
