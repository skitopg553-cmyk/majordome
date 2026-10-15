// Les modèles utilisés par Majordome et leur prix (USD par million de tokens).
// Source : platform.claude.com/docs/en/about-claude/pricing (vérifié le 2026-10-15).
// Si Anthropic change ses prix, il suffit de mettre à jour ce tableau.

export const MODELS = {
  // Niveau 2 : le Majordome qui te parle
  sonnet: "claude-sonnet-5-5",
  // Niveau 1 : petites tâches (tri, catégorisation) — utilisé à partir de la phase 1
  haiku: "claude-haiku-5-5",
} as const;

type Price = { input: number; output: number };

const PRICES: Record<string, Price> = {
  "claude-sonnet-5-5": { input: 2, output: 10 },
  // Haiku 5.5 : tarif pour les prompts ≤ 100k tokens (les nôtres seront bien en dessous)
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
  "claude-opus-5-5": { input: 4, output: 20 },
};

/** Coût estimé d'un appel, en dollars. Calcul en code, jamais par le LLM. */
export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const price = PRICES[model];
  if (!price) return 0;
  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
}
