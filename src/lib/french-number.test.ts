import { describe, expect, it } from "vitest";
import { frenchDecimal, frenchNumber, parseNumberWords } from "./french-number";

describe("frenchNumber : nombres en toutes lettres", () => {
  it.each([
    [0, "zéro"], [1, "un"], [7, "sept"], [16, "seize"], [21, "vingt et un"], [22, "vingt-deux"], [30, "trente"], [31, "trente et un"], [45, "quarante-cinq"],
    [60, "soixante"], [70, "soixante-dix"], [71, "soixante et onze"], [77, "soixante-dix-sept"], [80, "quatre-vingts"], [81, "quatre-vingt-un"], [91, "quatre-vingt-onze"], [99, "quatre-vingt-dix-neuf"],
    [100, "cent"], [101, "cent un"], [200, "deux cents"], [250, "deux cent cinquante"], [1000, "mille"], [2026, "deux mille vingt-six"], [3500, "trois mille cinq cents"], [1_000_000, "un million"], [2_000_001, "deux millions un"],
  ])("%i → %s", (n, w) => expect(frenchNumber(n)).toBe(w));
  it("hors limites ou non entier : les chiffres tels quels", () => {
    expect(frenchNumber(-3)).toBe("-3");
    expect(frenchNumber(2.5)).toBe("2.5");
    expect(frenchNumber(1e12)).toBe("1000000000000");
  });
  it("décimaux", () => expect(frenchDecimal(2, "5")).toBe("deux virgule cinq"));
});

describe("parseNumberWords : l'inverse (0 à 99)", () => {
  it.each([["sept", 7], ["Sept", 7], ["vingt-cinq", 25], ["vingt cinq", 25], ["trente et un", 31], ["soixante-dix", 70], ["soixante et onze", 71], ["quatre-vingts", 80], ["quatre-vingt-dix-sept", 97], ["douze", 12], ["12", 12]])("%s → %i", (w, n) => expect(parseNumberWords(w as string)).toBe(n));
  it("le reste → null", () => {
    for (const bad of ["", "banane", "vingt-banane", "cent"]) expect(parseNumberWords(bad)).toBeNull();
  });
  it("aller-retour sur 0 à 99", () => {
    for (let n = 0; n < 100; n++) expect(parseNumberWords(frenchNumber(n))).toBe(n);
  });
});
