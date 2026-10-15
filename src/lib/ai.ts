import Anthropic from "@anthropic-ai/sdk";
import { estimateCostUsd } from "./models";
import { supabaseAdmin } from "./supabase";

const anthropic = new Anthropic(); // lit ANTHROPIC_API_KEY automatiquement

type ChatMessage = { role: "user" | "assistant"; content: string };

/**
 * Point de passage UNIQUE vers l'API Claude.
 * Tout appel IA de l'app doit passer par ici : c'est ce qui garantit
 * que chaque appel est journalisé avec son coût dans la table ai_calls.
 */
export async function callClaude(opts: {
  model: string;
  system: string;
  messages: ChatMessage[];
  purpose: string; // ex. "chat", "briefing", "tri-mail"
  maxTokens?: number;
}): Promise<string> {
  const started = Date.now();
  const response = await anthropic.messages.create({
    model: opts.model,
    max_tokens: opts.maxTokens ?? 2048,
    system: opts.system,
    messages: opts.messages,
  });

  // La réponse peut contenir des blocs de "réflexion" : on ne garde que le texte.
  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => (block as { text: string }).text)
    .join("\n");

  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;

  // Journalisation : si elle échoue, on ne bloque pas la réponse, on le signale dans les logs.
  try {
    const { error } = await supabaseAdmin().from("ai_calls").insert({
      model: opts.model,
      purpose: opts.purpose,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: estimateCostUsd(opts.model, inputTokens, outputTokens),
      duration_ms: Date.now() - started,
    });
    if (error) console.error("Journalisation ai_calls échouée :", error.message);
  } catch (err) {
    console.error("Journalisation ai_calls échouée :", err);
  }

  return text;
}
