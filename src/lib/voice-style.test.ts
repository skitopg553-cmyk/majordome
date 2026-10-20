import { describe, expect, it } from "vitest";
import { breathe, forVoice, MOOD_TAG } from "./voice-style";

const LONGUE = "Bonne nouvelle, Monsieur : votre semaine est bien partie. Vous avez fait quatre séances de sport. Pour demain, je vous conseille de décaler le rendez-vous.";

describe("voix expressive : indication d'émotion selon l'humeur", () => {
  it("chaque humeur a son indication, « neutral » n'en a pas", () => {
    expect(MOOD_TAG.happy).toBe("[warmly]");
    expect(MOOD_TAG.surprised).toBe("[amused]");
    expect(MOOD_TAG.sad).toBe("[concerned]");
    expect(MOOD_TAG.neutral).toBeNull();
  });
  it("sans « expressive » (Flash, v2, OpenAI) : le texte n'est jamais touché, aucune balise ne serait lue à voix haute", () => {
    expect(forVoice(LONGUE, { mood: "happy", expressive: false })).toBe(LONGUE);
  });
  it("avec « expressive » : l'indication d'émotion est en tête", () => {
    expect(forVoice("Très bien, Monsieur. C'est noté.", { mood: "happy", expressive: true })).toBe("[warmly] Très bien, Monsieur. C'est noté.");
    expect(forVoice("Très bien, Monsieur. C'est noté.", { mood: "neutral", expressive: true })).toBe("Très bien, Monsieur. C'est noté.");
    expect(forVoice("Très bien, Monsieur. C'est noté.", { expressive: true })).toBe("Très bien, Monsieur. C'est noté.");
  });
});

describe("respiration des phrases", () => {
  it("un texte court reste court et brut", () => {
    expect(breathe("Ok, c'est noté.", "happy")).toBe("Ok, c'est noté.");
  });
  it("un texte long : une ligne par phrase (pauses), et une courte interjection selon l'humeur", () => {
    const t = "Votre semaine est bien partie. Vous avez fait quatre séances de sport. Pour demain, je vous conseille de décaler le rendez-vous.";
    const out = breathe(t, "happy");
    expect(out.split("\n").length).toBe(4);
    expect(out).toMatch(/^(Parfait\.|Fort bien\.)\n/);
    expect(breathe(t, "focus").startsWith("Voyons…\n")).toBe(true);
    expect(breathe(t, "neutral").split("\n").length).toBe(3); // neutre : pas d'interjection
  });
  it("jamais d'interjection doublée sur une phrase qui commence déjà par une formule", () => {
    expect(breathe(LONGUE.replace("Bonne nouvelle, Monsieur :", "Parfait, Monsieur :"), "happy").split("\n")[0]).toMatch(/^Parfait, Monsieur/);
    expect(breathe(`Bonjour, Monsieur. ${LONGUE}`, "happy").startsWith("Bonjour")).toBe(true);
  });
  it("même entrée, même sortie (pas de hasard)", () => {
    expect(forVoice(LONGUE, { mood: "happy", expressive: true })).toBe(forVoice(LONGUE, { mood: "happy", expressive: true }));
  });
});
