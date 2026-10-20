import { describe, expect, it } from "vitest";
import { INSTRUCTIONS } from "./instructions";
import { mirrorPrompt } from "./mirror";
import { alarmConfirmation, alarmWebText } from "./alarm-speech";
import { recapText } from "./slots";
import { friendlyError } from "./offline";

// Personnalité de Majordome : un grand majordome qui vouvoie « Monsieur ». Ces tests empêchent un retour silencieux au tutoiement.
describe("personnalité : vouvoiement et « Monsieur »", () => {
  it("le prompt système impose le vouvoiement, « Monsieur », la franchise sans culpabilisation", () => {
    expect(INSTRUCTIONS).toMatch(/VOUVOIES Ruben/);
    expect(INSTRUCTIONS).toMatch(/« Monsieur »/);
    expect(INSTRUCTIONS).toMatch(/sans jamais culpabiliser/);
    expect(INSTRUCTIONS).not.toMatch(/tutoies/i);
  });
  it("le miroir de la semaine vouvoie aussi", () => {
    expect(mirrorPrompt({ sessions: 1, activeDays: 1 } as never)).toMatch(/vouvoie/);
  });
  it("les phrases écrites par le code vouvoient et disent « Monsieur », sans tutoiement ni « Ok »", () => {
    const phrases = [alarmConfirmation(7, 30), alarmWebText(7, 30, "demain"), recapText(["Boxe anglaise mardi 18 h 30-20 h"]), friendlyError(new Error("Failed to fetch")), friendlyError("bizarre")];
    for (const p of phrases) {
      expect(p).toMatch(/Monsieur/);
      expect(p).not.toMatch(/\b(tu|ton|ta|tes|toi|Touche|Réessaie)\b|^Ok\b/);
    }
  });
});
