import { describe, expect, it } from "vitest";
import { createLimiter } from "./rate-limit";

describe("limite d'essais", () => {
  const T0 = 1_000_000;
  it("verrouille au 5e échec, déverrouille après 10 minutes", () => {
    const l = createLimiter(5, 600_000);
    for (let i = 0; i < 4; i++) l.fail("a", T0 + i);
    expect(l.isLocked("a", T0 + 10)).toBe(false);
    l.fail("a", T0 + 5);
    expect(l.isLocked("a", T0 + 6)).toBe(true);
    expect(l.isLocked("a", T0 + 5 + 599_999)).toBe(true);
    expect(l.isLocked("a", T0 + 5 + 600_000)).toBe(false);
  });
  it("chaque adresse a son compteur", () => {
    const l = createLimiter(2, 600_000);
    l.fail("a", T0);
    l.fail("a", T0);
    expect(l.isLocked("a", T0)).toBe(true);
    expect(l.isLocked("b", T0)).toBe(false);
  });
  it("de vieux échecs (hors fenêtre) ne s'additionnent pas ; un bon code remet à zéro", () => {
    const l = createLimiter(3, 600_000);
    l.fail("a", T0);
    l.fail("a", T0 + 1);
    l.fail("a", T0 + 700_000); // nouvelle fenêtre : compte 1
    expect(l.isLocked("a", T0 + 700_001)).toBe(false);
    l.fail("a", T0 + 700_002);
    l.clear("a");
    l.fail("a", T0 + 700_003);
    expect(l.isLocked("a", T0 + 700_004)).toBe(false);
  });
});
