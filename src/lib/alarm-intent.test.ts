import { describe, expect, it } from "vitest";
import { detectAlarmIntent, parseClock, parseDuration } from "./alarm-intent";

describe("parseClock : extraction heure / minutes", () => {
  it.each([
    ["à 7h", 7, 0], ["à 7 h", 7, 0], ["7h30", 7, 30], ["à 07:30", 7, 30], ["à 7 h 05", 7, 5], ["à 19h45", 19, 45],
    ["à sept heures", 7, 0], ["à sept heures trente", 7, 30], ["à vingt et une heures", 21, 0], ["à huit heures et demie", 8, 30], ["à 8 heures et quart", 8, 15],
    ["à 8 h moins le quart", 7, 45], ["à midi", 12, 0], ["à minuit", 0, 0], ["à 7h du soir", 19, 0], ["ce soir à 9h", 21, 0], ["à 6 heures", 6, 0],
  ])("%s → %i:%i", (t, h, m) => expect(parseClock(t as string)).toEqual({ hour: h, minutes: m }));
  it("refuse l'invalide ou l'absent", () => {
    for (const bad of ["demain", "à 25h", "à 7h75", "bientôt", ""]) expect(parseClock(bad)).toBeNull();
  });
});

describe("parseDuration", () => {
  it.each([
    ["5 minutes", 300], ["cinq minutes", 300], ["1 min", 60], ["une minute", 60], ["90 secondes", 90], ["1 heure", 3600], ["1h30", 5400], ["une heure et demie", 5400], ["1 h 15", 4500],
    ["un quart d'heure", 900], ["une demi-heure", 1800], ["trois quarts d'heure", 2700], ["deux minutes et demie", 150], ["vingt-cinq minutes", 1500], ["2 heures", 7200], ["1 minute 30 secondes", 90],
  ])("%s → %i s", (t, s) => expect(parseDuration(t as string)).toBe(s));
  it("rien ou trop long → null", () => {
    expect(parseDuration("bientôt")).toBeNull();
    expect(parseDuration("30 heures")).toBeNull();
    expect(parseDuration("")).toBeNull();
  });
});

describe("detectAlarmIntent : les vraies phrases du 18/10 et leurs variantes", () => {
  it("les 3 phrases qui avaient donné « Touche le bouton » sans carte", () => {
    expect(detectAlarmIntent("mets un réveil pour aujourd'hui à 16h51")).toEqual({ tool: "set_alarm", args: { hour: 16, minutes: 51 } });
    expect(detectAlarmIntent("mets un réveil à 7h demain")).toEqual({ tool: "set_alarm", args: { hour: 7, minutes: 0, day: "tomorrow" } });
    expect(detectAlarmIntent("est-ce que tu peux mettre un réveil pour 7h demain s'il te plaît")).toEqual({ tool: "set_alarm", args: { hour: 7, minutes: 0, day: "tomorrow" } });
  });
  it("variantes de réveil", () => {
    expect(detectAlarmIntent("Réveille-moi à 6h30")).toEqual({ tool: "set_alarm", args: { hour: 6, minutes: 30 } });
    expect(detectAlarmIntent("règle un réveil à sept heures et demie pour la salle")).toEqual({ tool: "set_alarm", args: { hour: 7, minutes: 30, label: "Salle" } });
    expect(detectAlarmIntent("mets un réveil dans 20 minutes")).toEqual({ tool: "set_alarm", args: { in_minutes: 20 } });
    expect(detectAlarmIntent("réveille-moi dans une heure et demie")).toEqual({ tool: "set_alarm", args: { in_minutes: 90 } });
  });
  it("minuteurs", () => {
    expect(detectAlarmIntent("minuteur de 5 minutes")).toEqual({ tool: "set_timer", args: { hours: 0, minutes: 5, seconds: 0 } });
    expect(detectAlarmIntent("lance un minuteur de dix minutes pour les pâtes")).toEqual({ tool: "set_timer", args: { hours: 0, minutes: 10, seconds: 0, label: "Pâtes" } });
    expect(detectAlarmIntent("mets un minuteur 1h15")).toEqual({ tool: "set_timer", args: { hours: 1, minutes: 15, seconds: 0 } });
  });
  it("ne devine pas : pas d'heure, annulation, simple récit, autre sujet", () => {
    for (const no of ["mets un réveil", "annule mon réveil de 7h", "je me réveille à 7h tous les jours", "mets un minuteur", "ajoute une tâche : acheter du pain à 7h", "quel est mon réveil ?", ""]) expect(detectAlarmIntent(no)).toBeNull();
  });
});
