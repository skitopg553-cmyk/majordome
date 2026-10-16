import { describe, expect, it } from "vitest";
import { barPercent, checkEstimate, computeMacros, dayTotals, FOODS, lookupFood, parseFood, parseNutritionGoals, toGrams } from "./food";

const now = new Date("2026-10-16T10:00:00+02:00");

describe("table d'aliments", () => {
  it("a environ 250 aliments, tous avec des valeurs plausibles pour 100 g", () => {
    expect(FOODS.length).toBeGreaterThanOrEqual(240);
    for (const f of FOODS) {
      const { kcal, protein, carbs, fat } = f.per100;
      expect(kcal, f.name).toBeLessThanOrEqual(900);
      expect(protein + carbs + fat, f.name).toBeLessThanOrEqual(101);
      // cohérence énergétique (±40 % ; l'alcool, les fibres et les arrondis expliquent l'écart) pour les aliments qui ont des calories
      const calc = 4 * protein + 4 * carbs + 9 * fat;
      if (kcal > 60 && !/vin|biere|champagne|whisky|alcool|bière/i.test(f.name)) expect(Math.abs(calc - kcal) / kcal, f.name).toBeLessThan(0.4);
    }
  });
});

describe("valeurs officielles Ciqual 2020", () => {
  const byCode = (code: number) => FOODS.find((f) => f.ciqual === code)!.per100;
  it("3 aliments vérifiés contre le fichier officiel (kcal, protéines, glucides, lipides pour 100 g)", () => {
    expect(byCode(9104)).toEqual({ kcal: 145, protein: 2.92, carbs: 31.8, fat: 0.41 }); // Riz blanc, cuit, non salé
    expect(byCode(19023)).toEqual({ kcal: 65.1, protein: 3.32, carbs: 4.85, fat: 3.63 }); // Lait entier, UHT
    expect(byCode(16400)).toEqual({ kcal: 753, protein: 0.7, carbs: 0.9, fat: 82.9 }); // Beurre à 82 % MG, doux
  });
  it("plus de la moitié de la table vient du fichier officiel, et l'aliment trouvé porte ses valeurs", () => {
    expect(FOODS.filter((f) => f.ciqual).length).toBeGreaterThan(FOODS.length / 2);
    expect(lookupFood("riz")?.per100.kcal).toBe(145);
  });
});

describe("lookupFood", () => {
  it("retrouve un aliment avec article, pluriel, accents ou précision", () => {
    expect(lookupFood("riz")?.name).toBe("Riz blanc cuit");
    expect(lookupFood("du riz")?.name).toBe("Riz blanc cuit");
    expect(lookupFood("Pâtes")?.name).toBe("Pâtes cuites");
    expect(lookupFood("pommes")?.name).toBe("Pomme");
    expect(lookupFood("riz cru")?.name).toBe("Riz blanc cru");
    expect(lookupFood("riz complet")?.name).toBe("Riz complet cuit");
    expect(lookupFood("pain au chocolat")?.name).toBe("Pain au chocolat");
    expect(lookupFood("tomate bio")?.name).toBe("Tomate");
  });
  it("ne devine pas quand c'est autre chose", () => {
    expect(lookupFood("gâteau au yaourt à la rhubarbe")).toBeNull();
    expect(lookupFood("xyzzy")).toBeNull();
    expect(lookupFood("   ")).toBeNull();
  });
});

describe("quantités", () => {
  const egg = lookupFood("oeuf");
  it("grammes, kilos, ml, cl, litres, cuillères", () => {
    expect(toGrams(50, "g", null)).toEqual({ ok: true, value: 50 });
    expect(toGrams(1.5, "kg", null)).toEqual({ ok: true, value: 1500 });
    expect(toGrams(25, "cl", null)).toEqual({ ok: true, value: 250 });
    expect(toGrams(2, "cuillere_soupe", null)).toEqual({ ok: true, value: 30 });
    expect(toGrams(30, undefined, null)).toEqual({ ok: true, value: 30 }); // sans unité : grammes
  });
  it("pièces : poids de la table ; refus si inconnu", () => {
    expect(toGrams(2, "piece", egg)).toEqual({ ok: true, value: 110 });
    expect(toGrams(1, "piece", lookupFood("riz"))).toMatchObject({ ok: false });
  });
  it("refuse l'absurde", () => {
    for (const q of [0, -5, NaN, 6000]) expect(toGrams(q, "g", null)).toMatchObject({ ok: false });
    expect(toGrams(1, "stère", null)).toMatchObject({ ok: false });
  });
});

describe("parseFood : « j'ai mangé 50 g de riz »", () => {
  it("calcule en code à partir de la table", () => {
    const r = parseFood({ food: "riz", quantity: 50, unit: "g" }, now);
    expect(r).toEqual({ ok: true, value: { date: "2026-10-16", label: "Riz blanc cuit", grams: 50, macros: { kcal: 72.5, protein: 1.5, carbs: 15.9, fat: 0.2 }, estimated: 0 } });
  });
  it("2 œufs", () => {
    const r = parseFood({ food: "œufs", quantity: 2, unit: "piece" }, now);
    expect(r).toMatchObject({ ok: true, value: { grams: 110, macros: { kcal: 147.4 }, estimated: 0 } });
  });
  it("l'aliment connu l'emporte sur une estimation du modèle", () => {
    const r = parseFood({ food: "riz", quantity: 100, unit: "g", estimate_per_100g: { kcal: 1, protein: 0, carbs: 0, fat: 0 } }, now);
    expect(r).toMatchObject({ ok: true, value: { macros: { kcal: 145 }, estimated: 0 } });
  });
  it("aliment inconnu : exige une estimation, la marque « estimé »", () => {
    expect(parseFood({ food: "gâteau de la grand-mère", quantity: 100, unit: "g" }, now)).toMatchObject({ ok: false, error: expect.stringContaining("estimate_per_100g") });
    const r = parseFood({ food: "gâteau de la grand-mère", quantity: 200, unit: "g", estimate_per_100g: { kcal: 350, protein: 5, carbs: 50, fat: 15 } }, now);
    expect(r).toMatchObject({ ok: true, value: { label: "gâteau de la grand-mère", grams: 200, macros: { kcal: 700, protein: 10, carbs: 100, fat: 30 }, estimated: 1 } });
  });
  it("refuse une estimation absurde ou incohérente", () => {
    expect(checkEstimate({ kcal: 2000, protein: 1, carbs: 1, fat: 1 }).ok).toBe(false);
    expect(checkEstimate({ kcal: 100, protein: 50, carbs: 50, fat: 50 }).ok).toBe(false);
    expect(checkEstimate({ kcal: 50, protein: 30, carbs: 30, fat: 30 }).ok).toBe(false); // 4·30+4·30+9·30 = 510 ≠ 50
    expect(checkEstimate({ kcal: -1, protein: 1, carbs: 1, fat: 1 }).ok).toBe(false);
    expect(checkEstimate(null).ok).toBe(false);
  });
  it("date : hier accepté, futur refusé", () => {
    expect(parseFood({ food: "riz", quantity: 50, date: "2026-10-15" }, now)).toMatchObject({ ok: true, value: { date: "2026-10-15" } });
    expect(parseFood({ food: "riz", quantity: 50, date: "2026-10-20" }, now)).toMatchObject({ ok: false });
    expect(parseFood({ quantity: 50 }, now)).toMatchObject({ ok: false });
  });
});

describe("totaux, objectifs, barres", () => {
  it("additionne et arrondit ; signale l'estimé", () => {
    expect(dayTotals([{ kcal: 65.4, protein: 1.4, carbs: 14, fat: 0.2 }, { kcal: 100.4, protein: 5, carbs: 3, fat: 2, estimated: 1 }])).toEqual({ kcal: 166, protein: 6, carbs: 17, fat: 2, estimated: true });
    expect(dayTotals([])).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0, estimated: false });
  });
  it("barre bornée 0–100 %, absente sans objectif", () => {
    expect(barPercent(50, 200)).toBe(25);
    expect(barPercent(400, 200)).toBe(100);
    expect(barPercent(50, null)).toBeNull();
    expect(barPercent(50, 0)).toBeNull();
  });
  it("objectifs : seuls les champs donnés, bornes strictes", () => {
    expect(parseNutritionGoals({ kcal: 2200, protein: 140 })).toEqual({ ok: true, value: { kcal: 2200, protein: 140 } });
    for (const bad of [{}, { kcal: 100 }, { kcal: 9000 }, { protein: -1 }, { fat: "beaucoup" }]) expect(parseNutritionGoals(bad)).toMatchObject({ ok: false });
  });
  it("computeMacros proportionnel", () => {
    expect(computeMacros({ kcal: 200, protein: 10, carbs: 20, fat: 5 }, 150)).toEqual({ kcal: 300, protein: 15, carbs: 30, fat: 7.5 });
  });
});
