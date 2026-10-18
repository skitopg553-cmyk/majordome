import { describe, expect, it } from "vitest";
import { blend, EMO, eyeStyle, moodPrefix, MoodStripper, parseMood, splitMood, stepParams, stripMood } from "./mascot";

describe("balise @mood:", () => {
  it("retire la balise de la première ligne et donne l'humeur", () => {
    expect(stripMood("@mood:happy\nSalut Ruben !")).toEqual({ text: "Salut Ruben !", mood: "happy" });
  });
  it("sans balise : texte intact, pas d'humeur", () => {
    expect(stripMood("Salut Ruben !")).toEqual({ text: "Salut Ruben !", mood: null });
    expect(stripMood("Mon e-mail est a@mood.fr")).toEqual({ text: "Mon e-mail est a@mood.fr", mood: null }); // « @ » hors début de ligne
  });
  it("balise inconnue → neutral ; majuscules et espaces tolérés", () => {
    expect(stripMood("@mood:furieux\nOk").mood).toBe("neutral");
    expect(stripMood("@mood: Sad \nOk")).toEqual({ text: "Ok", mood: "sad" });
    expect(parseMood("blink")).toBe("neutral"); // blink et sleepy sont réservés au code
    expect(parseMood(42)).toBe("neutral");
  });
  it("balise coupée entre deux morceaux du flux : rien n'est affiché de la balise", () => {
    const s = new MoodStripper();
    const parts = ["@mo", "od:ha", "ppy", "\nBon", "jour"];
    const out = parts.map((p) => s.feed(p));
    expect(out.map((o) => o.text).join("")).toBe("Bonjour");
    expect(out.flatMap((o) => o.moods)).toEqual(["happy"]);
  });
  it("faux départ de balise coupé en deux : le texte est rendu en entier", () => {
    const s = new MoodStripper();
    const a = s.feed("@mo");
    const b = s.feed("nde entier");
    expect(a.text + b.text + s.finish().text).toBe("@monde entier");
  });
  it("balise sans fin de ligne à la fin du flux : humeur gardée, rien d'affiché ; texte retenu rendu", () => {
    const s = new MoodStripper();
    expect(s.feed("@mood:sad").text).toBe("");
    expect(s.finish()).toEqual({ text: "", moods: ["sad"] });
    const t = new MoodStripper();
    expect(t.feed("@mo").text).toBe("");
    expect(t.finish().text).toBe("@mo");
  });
  it("une balise au milieu (réponse en plusieurs étapes) est aussi retirée", () => {
    expect(stripMood("Je note ça.\n\n@mood:happy\nC'est fait.")).toEqual({ text: "Je note ça.\n\nC'est fait.", mood: "happy" });
  });
});

describe("humeur en tête du flux", () => {
  it("préfixe puis texte ; incomplet = rien à afficher ; absent = tout est du texte", () => {
    expect(splitMood(moodPrefix("happy") + "Salut")).toEqual({ mood: "happy", rest: "Salut" });
    expect(splitMood("\u001fhap")).toEqual({ mood: null, rest: "" });
    expect(splitMood("Salut")).toEqual({ mood: null, rest: "Salut" });
  });
});

describe("émotions", () => {
  it("les valeurs de la maquette", () => {
    expect(EMO.neutral).toEqual({ w: 0.5, h: 1, r: 0.25, ta: 0, tc: 0, bc: 0 });
    expect(EMO.angry).toEqual({ w: 0.52, h: 0.86, r: 0.22, ta: 24, tc: 0.4, bc: 0.06 });
    expect(EMO.sleepy.tc).toBe(0.56);
  });
  it("interpolation linéaire entre deux émotions", () => {
    const mid = blend(EMO.neutral, EMO.surprised, 0.5);
    expect(mid.w).toBeCloseTo(0.57);
    expect(mid.h).toBeCloseTo(1.06);
    expect(blend(EMO.neutral, EMO.happy, 0)).toEqual(EMO.neutral);
    expect(blend(EMO.neutral, EMO.happy, 1)).toEqual(EMO.happy);
  });
  it("le pas d'animation converge en ~120 ms, sans dépendre des images par seconde", () => {
    let a = EMO.neutral;
    for (let i = 0; i < 8; i++) a = stepParams(a, EMO.happy, 15); // 8 images à 15 ms = 120 ms
    let b = EMO.neutral;
    for (let i = 0; i < 2; i++) b = stepParams(b, EMO.happy, 60); // 2 images à 60 ms = 120 ms
    expect(a.bc).toBeCloseTo(b.bc, 6);
    expect(a.bc).toBeGreaterThan(0.56 * 0.94); // presque arrivé après 120 ms
    expect(stepParams(EMO.neutral, EMO.happy, 0)).toEqual(EMO.neutral);
  });
  it("style d'un œil : paupières en miroir, tailles proportionnelles à S", () => {
    const left = eyeStyle(EMO.angry, 100, 0);
    const right = eyeStyle(EMO.angry, 100, 1);
    expect(left.width).toBe(52);
    expect(left.height).toBe(86);
    expect(left.topLidRotate).toBe(24);
    expect(right.topLidRotate).toBe(-24);
    expect(left.topLidTop).toBeCloseTo(-60); // (0,4 − 1) × 100 %
    expect(eyeStyle(EMO.happy, 100, 0).bottomLidTop).toBeCloseTo(44); // (1 − 0,56) × 100 %
  });
});
