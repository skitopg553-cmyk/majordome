import { describe, expect, it } from "vitest";
import { alarmConfirmation, alarmFailure, alarmWebText, durationWords, hourWords, timerConfirmation, timerWebText } from "./alarm-speech";

describe("hourWords / confirmation de réveil", () => {
  it.each([
    [7, 0, "sept heures"], [7, 30, "sept heures trente"], [7, 45, "sept heures quarante-cinq"], [0, 0, "minuit"], [0, 5, "minuit cinq"], [12, 0, "midi"], [12, 15, "midi quinze"],
    [1, 0, "une heure"], [1, 30, "une heure trente"], [13, 0, "treize heures"], [21, 5, "vingt et une heures cinq"], [23, 59, "vingt-trois heures cinquante-neuf"], [10, 10, "dix heures dix"],
  ])("%i:%i → %s", (h, m, w) => expect(hourWords(h, m)).toBe(w));
  it("phrase complète", () => {
    expect(alarmConfirmation(7, 0)).toBe("Ok, réveil réglé à sept heures.");
    expect(alarmConfirmation(0, 0)).toBe("Ok, réveil réglé à minuit.");
    expect(alarmConfirmation(12, 0)).toBe("Ok, réveil réglé à midi.");
    expect(alarmFailure).toBe("Je n'ai pas réussi à régler le réveil.");
  });
});

describe("durationWords / confirmation de minuteur", () => {
  it.each([
    [60, "une minute"], [90, "une minute trente"], [300, "cinq minutes"], [3600, "une heure"], [4500, "une heure quinze"], [45, "quarante-cinq secondes"], [1, "une seconde"], [7200, "deux heures"], [3661, "une heure, une minute et une seconde"], [1200, "vingt minutes"],
  ])("%i s → %s", (s, w) => expect(durationWords(s)).toBe(w));
  it("phrase complète avec l'élision « d'une »", () => {
    expect(timerConfirmation(60)).toBe("Minuteur d'une minute lancé.");
    expect(timerConfirmation(90)).toBe("Minuteur d'une minute trente lancé.");
    expect(timerConfirmation(4500)).toBe("Minuteur d'une heure quinze lancé.");
    expect(timerConfirmation(300)).toBe("Minuteur de cinq minutes lancé.");
    expect(timerConfirmation(11 * 60)).toBe("Minuteur de onze minutes lancé."); // pas d'élision devant « onze »
  });
});

describe("textes du web : la phrase promet un bouton seulement quand la carte est envoyée", () => {
  it("réveil et minuteur", () => {
    expect(alarmWebText(7, 30, "demain")).toBe("Réveil demain à sept heures trente prêt. Touche le bouton pour le créer.");
    expect(alarmWebText(16, 51, "aujourd'hui")).toBe("Réveil à seize heures cinquante et un prêt. Touche le bouton pour le créer.");
    expect(timerWebText(300)).toBe("Minuteur de cinq minutes prêt. Touche le bouton pour le lancer.");
  });
});
