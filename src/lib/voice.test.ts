import { describe, expect, it } from "vitest";
import { orbState, pickFrenchVoice, plainText } from "./voice";

const base = { listening: false, waiting: false, busy: false, speaking: false };

describe("orbState", () => {
  it("repos par défaut", () => expect(orbState(base)).toBe("idle"));
  it("écoute pendant la dictée, même si une réponse est en cours", () => {
    expect(orbState({ ...base, listening: true })).toBe("listening");
    expect(orbState({ ...base, listening: true, busy: true, speaking: true })).toBe("listening");
  });
  it("réflexion jusqu'au premier mot", () => expect(orbState({ ...base, waiting: true, busy: true })).toBe("thinking"));
  it("parle pendant que le texte arrive puis pendant la lecture", () => {
    expect(orbState({ ...base, busy: true })).toBe("speaking");
    expect(orbState({ ...base, speaking: true })).toBe("speaking");
  });
});

describe("plainText", () => {
  it("retire le markdown pour la lecture", () => {
    expect(plainText("Voici :\n\n- **Appeler** le médecin\n- Voir [Léa](https://x.fr)\n\n1. `Payer`")).toBe(
      "Voici :\nAppeler le médecin\nVoir Léa\nPayer",
    );
  });
  it("retire l'émoji d'alerte", () => expect(plainText("⚠️ Erreur IA")).toBe("Erreur IA"));
});

describe("pickFrenchVoice", () => {
  const v = (name: string, lang: string) => ({ name, lang });
  it("préfère une voix fr-FR de qualité", () => {
    const voices = [v("English", "en-US"), v("Amélie", "fr-CA"), v("Thomas", "fr-FR"), v("Google français", "fr-FR")];
    expect(pickFrenchVoice(voices)?.name).toBe("Google français");
  });
  it("prend sinon une voix fr-FR, puis n'importe quel français", () => {
    expect(pickFrenchVoice([v("Amélie", "fr-CA"), v("Thomas", "fr_FR")])?.name).toBe("Thomas");
    expect(pickFrenchVoice([v("Amélie", "fr-CA")])?.name).toBe("Amélie");
  });
  it("renvoie null sans voix française", () => expect(pickFrenchVoice([v("English", "en-US")])).toBeNull());
});
