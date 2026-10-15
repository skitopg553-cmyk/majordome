import { describe, expect, it } from "vitest";
import { ambiguousPrompt, CATEGORIES, categorizeByRules, parseAmbiguousReply } from "./categorize";

describe("categorizeByRules", () => {
  it("reconnaît les libellés courants, sans tenir compte des accents ni de la casse", () => {
    expect(categorizeByRules("CB CARREFOUR CITY 04/10")).toBe("Courses");
    expect(categorizeByRules("PRLV SEPA NAVIGO ANNUEL")).toBe("Transport");
    expect(categorizeByRules("VIR SALAIRE ACME SAS")).toBe("Revenu");
    expect(categorizeByRules("CB UBER EATS")).toBe("Restaurants"); // « uber eats » passe avant « uber »
    expect(categorizeByRules("Pharmacie Lépine")).toBe("Sport & santé");
  });
  it("respecte l'ordre des règles (la première gagne)", () => {
    expect(categorizeByRules("AMAZON PRIME")).toBe("Abonnements");
    expect(categorizeByRules("AMAZON EU SARL")).toBe("Shopping");
  });
  it("renvoie null quand rien ne correspond (cas ambigu → Haiku)", () => {
    expect(categorizeByRules("PAYPAL *JEANDUPONT")).toBeNull();
  });
  it("accepte des règles personnalisées", () => {
    expect(categorizeByRules("CHEZ MAMIE", [{ category: "Famille", keywords: ["mamie"] }])).toBe("Famille");
  });
});

describe("Haiku pour les cas ambigus", () => {
  it("le prompt liste les catégories et numérote les libellés", () => {
    const p = ambiguousPrompt(["PAYPAL *X", "SUMUP *CAFE"]);
    expect(p).toContain("1. PAYPAL *X");
    expect(p).toContain("2. SUMUP *CAFE");
    for (const c of CATEGORIES) expect(p).toContain(c);
  });
  it("lit la réponse JSON, même entourée de texte, et remplace l'inconnu par Autre", () => {
    expect(parseAmbiguousReply('Voici : ["Restaurants", "Licornes"]', 3)).toEqual(["Restaurants", "Autre", "Autre"]);
    expect(parseAmbiguousReply("pas du json", 2)).toEqual(["Autre", "Autre"]);
  });
});
