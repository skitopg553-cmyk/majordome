import { describe, expect, it } from "vitest";
import { IdScrubber, scrubIds } from "./id-scrub";

describe("jamais d'identifiant dans une réponse", () => {
  it("retire #14, (#3), [#7]", () => {
    expect(scrubIds("Voici : Cours #1, Restaurant avec Arthur (#14) et [#7] Boxe.")).toBe("Voici : Cours, Restaurant avec Arthur et Boxe.");
  });
  it("garde le reste (heures, nombres, dièse seul)", () => {
    expect(scrubIds("Cours 9 h-12 h, 3 tâches, C# et 20 %")).toBe("Cours 9 h-12 h, 3 tâches, C# et 20 %");
  });
  it("identifiant coupé entre deux morceaux du flux", () => {
    const s = new IdScrubber();
    const out = ["Cours (", "#", "1", "2) puis Boxe #", "3 fin"].map((c) => s.feed(c)).join("") + s.finish();
    expect(out).toBe("Cours puis Boxe fin");
  });
  it("le texte normal passe sans attendre", () => {
    const s = new IdScrubber();
    expect(s.feed("Bonjour Ruben")).toBe("Bonjour Ruben");
    expect(s.feed(" à 9 h")).toBe(" à 9 h");
  });
});
