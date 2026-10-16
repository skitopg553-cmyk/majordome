import { describe, expect, it } from "vitest";
import { amounts, applyIntents, claimsActionWithoutTool, detectIntents } from "./intents";

const goal = (label: string, target: number, saved?: number) => [{ tool: "set_goal", args: { label, target, ...(saved !== undefined ? { saved } : {}) } }];
const mem = (content: string, category: string) => [{ tool: "remember", args: { content, category } }];

describe("amounts : montants en euros", () => {
  it("lit « 3k », « 3 000 € », « 3.000 euros », « 1 500,50 € », « 3,5k »", () => {
    const v = (s: string) => amounts(s).map((a) => a.value);
    expect(v("3k")).toEqual([3000]);
    expect(v("3 000 €")).toEqual([3000]);
    expect(v("3.000 euros")).toEqual([3000]);
    expect(v("1 500,50 €")).toEqual([1500.5]);
    expect(v("3,5k")).toEqual([3500]);
    expect(v("3000€ puis 450 euros")).toEqual([3000, 450]);
  });
  it("ne prend jamais pour de l'argent : « 10k pas », « 5k » de course, des chiffres sans unité", () => {
    for (const s of ["10k pas", "5k en 25 min", "3000 pour une voiture", "100 pompes", "12 km"]) expect(amounts(s)).toEqual([]);
  });
});

describe("objectif d'épargne chiffré → set_goal (les VRAIES phrases qui ont échoué)", () => {
  it.each([
    ["creation objectif : economisé 3k pour une voiture", "Voiture", 3000],
    ["objectif 3000 € pour une voiture", "Voiture", 3000],
    ["Mon objectif est d'économiser 3 000 euros pour un voyage au Japon", "Voyage au Japon", 3000],
    ["je veux économiser 5k pour mon permis", "Permis", 5000],
    ["objectif : 1 200€ pour des vacances, et j'ai déjà 300 €", "Vacances", 1200],
  ])("« %s »", (text, label, target) => {
    const [i] = detectIntents(text);
    expect(i.tool).toBe("set_goal");
    expect(i.args).toMatchObject({ label, target });
  });
  it("lit ce qui est déjà de côté", () => {
    expect(detectIntents("objectif 3000 € pour une voiture, j'ai déjà 450 €")).toEqual(goal("Voiture", 3000, 450));
    expect(detectIntents("j'ai déjà 450€ de côté, mon objectif est 3000 € pour une voiture")).toEqual(goal("Voiture", 3000, 450));
  });
  it("sans « pour… », le nom par défaut est « Épargne »", () => {
    expect(detectIntents("objectif 2000 €")).toEqual(goal("Épargne", 2000));
  });
  it("ne confond pas avec un budget, une dépense passée ou une autre unité", () => {
    expect(detectIntents("mon budget courses est de 300 €")).toEqual([]);
    expect(detectIntents("j'ai économisé 200 € ce mois")).toEqual([]);
    expect(detectIntents("mon objectif est de faire 10k pas par jour")).toEqual(mem("Faire 10k pas par jour", "objectif"));
  });
});

describe("« retiens que… » → remember", () => {
  it.each([
    ["retiens que je suis allergique aux arachides", "Je suis allergique aux arachides", "info"],
    ["Retiens bien que je préfère les réponses courtes", "Je préfère les réponses courtes", "preference"],
    ["n'oublie pas que je cours toujours le mardi", "Je cours toujours le mardi", "habitude"],
    ["stp mémorise que mon objectif est de lire 20 livres", "Mon objectif est de lire 20 livres", "objectif"],
    ["souviens-toi que ma sœur s'appelle Léa", "Ma sœur s'appelle Léa", "info"],
  ])("« %s »", (text, content, category) => {
    expect(detectIntents(text)).toEqual(mem(content, category));
  });
  it("ordre vide ou trop court : rien", () => {
    expect(detectIntents("retiens")).toEqual([]);
    expect(detectIntents("retiens que")).toEqual([]);
  });
});

describe("« mon objectif est… » sans montant → souvenir « objectif »", () => {
  it.each([
    ["mon objectif est de courir un semi-marathon avant juin", "Courir un semi-marathon avant juin"],
    ["objectif : perdre 5 kg", "Perdre 5 kg"],
  ])("« %s »", (text, content) => expect(detectIntents(text)).toEqual(mem(content, "objectif")));
});

describe("phrases ambiguës : on ne touche à rien (le modèle décide, guidé par ses consignes)", () => {
  it.each(["je veux appeler le médecin", "je veux perdre 5 kg", "salut", "j'ai fait 2000 pas", "ajoute une tâche : appeler Paul", "tu retiens quoi sur moi ?", "qu'est-ce que tu retiens de moi"])("« %s »", (text) => {
    expect(detectIntents(text)).toEqual([]);
  });
});

describe("applyIntents (avec un faux exécuteur d'outils)", () => {
  it("appelle le bon outil avec les bons arguments et décrit le résultat pour le modèle", async () => {
    const calls: [string, unknown][] = [];
    const exec = async (n: string, a: Record<string, unknown>) => (calls.push([n, a]), JSON.stringify({ ok: true, action: "créé" }));
    const notes = await applyIntents("objectif 3000 € pour une voiture, j'ai déjà 450 €", exec);
    expect(calls).toEqual([["set_goal", { label: "Voiture", target: 3000, saved: 450 }]]);
    expect(notes).toEqual(["Objectif « Voiture » créé : 3000 €, déjà 450 € de côté."]);
    const n2 = await applyIntents("retiens que j'aime le thé", async () => JSON.stringify({ ok: true }));
    expect(n2[0]).toMatch(/Souvenir noté \(preference\)/);
  });
  it("un échec d'outil est transmis honnêtement au modèle", async () => {
    const notes = await applyIntents("objectif 3000 € pour une voiture", async () => JSON.stringify({ ok: false, error: "table manquante" }));
    expect(notes[0]).toMatch(/Échec de « set_goal » : table manquante/);
  });
  it("phrase ordinaire : aucun appel", async () => {
    let n = 0;
    expect(await applyIntents("bonjour", async () => (n++, "{}"))).toEqual([]);
    expect(n).toBe(0);
  });
});

describe("claimsActionWithoutTool (le faux « c'est noté »)", () => {
  it("détecte une affirmation d'enregistrement sans aucun outil appelé", () => {
    for (const r of ["J'ai noté ton objectif d'économiser 3000 € pour une voiture.", "C'est enregistré !", "Je viens d'ajouter ta séance.", "j'ai créé ton objectif", "J’ai mis à jour ton budget"]) {
      expect(claimsActionWithoutTool(r, 0)).toBe(true);
    }
  });
  it("jamais d'alerte si au moins un outil a été appelé, ou si ce n'est pas une affirmation d'action", () => {
    expect(claimsActionWithoutTool("J'ai noté ton objectif.", 1)).toBe(false);
    for (const r of ["Cet objectif est déjà noté dans l'app.", "Tu as 2 tâches aujourd'hui.", "Veux-tu que je le note ?", "Je peux le noter si tu veux."]) {
      expect(claimsActionWithoutTool(r, 0)).toBe(false);
    }
  });
});
