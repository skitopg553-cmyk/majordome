import { afterEach, describe, expect, it, vi } from "vitest";
import { estimateCostUsd } from "./models";

describe("estimateCostUsd", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("Claude Sonnet : 2 $ / million en entrée, 10 $ en sortie", () => {
    expect(estimateCostUsd("claude-sonnet-5-5", 1_000_000, 100_000)).toBe(3);
  });
  it("gpt-4o-mini a maintenant un prix (avant : 0 $ enregistré pour chaque appel)", () => {
    expect(estimateCostUsd("gpt-4o-mini", 1_000_000, 1_000_000)).toBeCloseTo(0.75, 6);
    expect(estimateCostUsd("gpt-4o-mini", 700, 40)).toBeGreaterThan(0);
  });
  it("modèle inconnu : prix des variables d'environnement s'il y en a, sinon 0 (jamais d'invention)", () => {
    expect(estimateCostUsd("modele-inconnu", 1000, 1000)).toBe(0);
    vi.stubEnv("OPENAI_PRICE_INPUT_PER_MTOK", "1");
    vi.stubEnv("OPENAI_PRICE_OUTPUT_PER_MTOK", "2");
    expect(estimateCostUsd("modele-inconnu", 1_000_000, 1_000_000)).toBe(3);
  });
});
