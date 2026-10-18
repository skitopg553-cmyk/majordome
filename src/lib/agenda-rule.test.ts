import { describe, expect, it } from "vitest";
import { INSTRUCTIONS } from "./instructions";
import { TOOLS } from "./tools";

// La règle agenda / tâche est appliquée par l'IA : ses consignes et ses outils doivent la dire clairement.
describe("règle agenda / tâche dans les consignes de l'IA", () => {
  it("heure précise = agenda, sans heure = tâche à minuit, jamais d'heure inventée", () => {
    expect(INSTRUCTIONS).toContain("AVEC une heure précise");
    expect(INSTRUCTIONS).toContain("SANS heure");
    expect(INSTRUCTIONS).toContain("T00:00:00");
    expect(INSTRUCTIONS).toContain("N'invente JAMAIS une heure");
    expect(INSTRUCTIONS).not.toMatch(/mets 09:00/);
  });
  it("les descriptions d'outils l'expliquent", () => {
    const add = TOOLS.find((t) => t.name === "add_task")!;
    expect(add.description).toMatch(/agenda/i);
    expect(add.description).toMatch(/tâche/i);
    const dueAt = (add.parameters as { properties: { due_at: { description: string } } }).properties.due_at.description;
    expect(dueAt).toContain("T00:00:00");
    expect(dueAt).toMatch(/AGENDA/);
  });
});

describe("humeur de la mascotte dans les consignes", () => {
  it("le modèle doit commencer par @mood: et ne jamais culpabiliser", () => {
    expect(INSTRUCTIONS).toContain("@mood:xxx");
    expect(INSTRUCTIONS).toMatch(/angry.*SEULEMENT si Ruben te parle mal/);
    expect(INSTRUCTIONS).toMatch(/jamais le culpabiliser|ne doit jamais le culpabiliser/);
  });
});
