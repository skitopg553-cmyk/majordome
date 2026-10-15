import { describe, expect, it } from "vitest";
import { isSimilar } from "./tools";

describe("isSimilar (anti-doublon des tâches)", () => {
  it("ignore la casse, les accents et la ponctuation", () => {
    expect(isSimilar("Appeler le médecin !", "appeler le medecin")).toBe(true);
    expect(isSimilar("RDV : banque", "rdv banque")).toBe(true);
  });
  it("considère qu'un titre contenu dans l'autre est un doublon", () => {
    expect(isSimilar("Appeler le médecin", "Appeler le médecin demain matin")).toBe(true);
  });
  it("laisse passer des tâches différentes", () => {
    expect(isSimilar("Appeler le médecin", "Prendre RDV chez le dentiste")).toBe(false);
  });
  it("ne compare jamais un titre vide (ou fait seulement de ponctuation)", () => {
    expect(isSimilar("", "Appeler")).toBe(false);
    expect(isSimilar("!!!", "Appeler")).toBe(false);
  });
});
