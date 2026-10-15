import { describe, expect, it } from "vitest";
import { daySummary } from "./summary";

describe("daySummary", () => {
  it("couvre tous les cas sans phrase bancale", () => {
    expect(daySummary(0, 0)).toBe("Rien d'urgent aujourd'hui. Profite.");
    expect(daySummary(0, 1)).toBe("Rien de prévu aujourd'hui, mais 1 tâche en retard.");
    expect(daySummary(0, 3)).toBe("Rien de prévu aujourd'hui, mais 3 tâches en retard.");
    expect(daySummary(1, 0)).toBe("Tu as 1 tâche aujourd'hui.");
    expect(daySummary(2, 1)).toBe("Tu as 2 tâches aujourd'hui, et 1 en retard.");
  });
});
