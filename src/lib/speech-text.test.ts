import { describe, expect, it } from "vitest";
import { splitSentences, toSpokenText } from "./speech-text";

describe("toSpokenText : balises, markdown, emojis", () => {
  it("retire la balise d'humeur (même au milieu) et les séparateurs internes du flux", () => {
    expect(toSpokenText("@mood:happy\nSalut Ruben !")).toBe("Salut Ruben !");
    expect(toSpokenText("Un.\n@mood:sad\nDeux.")).toBe("Un. Deux.");
    expect(toSpokenText("\u001fhappy\u001fBonjour\u001eannul")).toBe("Bonjourannul.");
  });
  it("retire le markdown sans en prononcer les signes", () => {
    expect(toSpokenText("**Attention** : *vraiment* important")).toBe("Attention : vraiment important.");
    expect(toSpokenText("## Ta journée\n- Appeler le médecin\n- Payer le loyer")).toBe("Ta journée. Appeler le médecin. Payer le loyer.");
    expect(toSpokenText("Voir [mon agenda](https://exemple.fr/a) et `code`")).toBe("Voir mon agenda et code.");
    expect(toSpokenText("Le lien : https://exemple.fr/très/long")).toBe("Le lien : le lien.");
    expect(toSpokenText("1. Premier\n2. Second")).toBe("Premier. Second.");
  });
  it("retire les emojis", () => {
    expect(toSpokenText("Bravo 🎉🙂 ! ⚠️ Attention")).toBe("Bravo ! Attention.");
  });
});

describe("toSpokenText : chiffres et heures en français naturel", () => {
  it.each([
    ["Réveil à 7:30", "Réveil à sept heures trente."],
    ["Réveil à 07h30", "Réveil à sept heures trente."],
    ["rendez-vous à 14h", "rendez-vous à quatorze heures."],
    ["à 16h51", "à seize heures cinquante et un."],
    ["il est 00:00", "il est minuit."],
    ["à 12:00", "à midi."],
    ["Tu as 3 tâches aujourd'hui, dont 2 avant midi.", "Tu as trois tâches aujourd'hui, dont deux avant midi."],
    ["Il reste 12,50 € ce mois-ci", "Il reste douze euros cinquante ce mois-ci."],
    ["Loyer : 700 €", "Loyer : sept cents euros."],
    ["Libre : 1 250 €", "Libre : mille deux cent cinquante euros."],
    ["1 €", "un euro."],
    ["Tu as dépensé 20 % de plus", "Tu as dépensé vingt pour cent de plus."],
    ["Course de 5 km en 25 min", "Course de cinq kilomètres en vingt-cinq minutes."],
    ["2 000 kcal", "deux mille kilocalories."],
    ["200 g de riz", "deux cents grammes de riz."],
    ["Le 16/10 à 9h", "Le seize octobre à neuf heures."],
    ["le 1er octobre", "le premier octobre."],
    ["Moyenne de 7,5 heures", "Moyenne de sept virgule cinq heures."],
    ["en 2026", "en deux mille vingt-six."],
  ])("%s", (input, out) => expect(toSpokenText(input)).toBe(out));
  it("jamais de chiffre ni de signe à lire à l'arrivée", () => {
    const spoken = toSpokenText("**Réveil réglé à 7:30.** Tu as 3 tâches 🎯, 12,50 € et 20 % de marge.");
    expect(spoken).not.toMatch(/[0-9*:%€]/u);
  });
  it("texte vide → vide ; point final ajouté seulement si besoin", () => {
    expect(toSpokenText("")).toBe("");
    expect(toSpokenText("Ok, c'est fait.")).toBe("Ok, c'est fait.");
    expect(toSpokenText("Quoi ?")).toBe("Quoi ?");
  });
});

describe("splitSentences : lecture phrase par phrase", () => {
  it("coupe aux fins de phrase", () => {
    expect(splitSentences("Ok, c'est fait. Tu as trois tâches. Bonne journée !")).toEqual(["Ok, c'est fait.", "Tu as trois tâches.", "Bonne journée !"]);
  });
  it("coupe une phrase trop longue aux virgules, sans rien perdre", () => {
    const long = Array.from({ length: 12 }, (_, i) => `élément numéro ${i}`).join(", ") + ".";
    const parts = splitSentences(long, 80);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.every((p) => p.length <= 100)).toBe(true);
    expect(parts.join(" ").replace(/\s+/g, " ")).toBe(long);
  });
  it("colle un fragment minuscule à la phrase suivante ; vide → aucune phrase", () => {
    expect(splitSentences("A. Voici la suite de ma réponse.")).toEqual(["A. Voici la suite de ma réponse."]);
    expect(splitSentences("   ")).toEqual([]);
  });
});
