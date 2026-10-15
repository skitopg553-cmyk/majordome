import Anthropic from "@anthropic-ai/sdk";
import { estimateCostUsd, MODELS } from "./models";
import { supabaseAdmin } from "./supabase";

type ChatMessage = { role: "user" | "assistant"; content: string };
type Tier = "sonnet" | "haiku";

// Fournisseur choisi par variable d'environnement : "anthropic" (défaut) ou "openai".
// Basculer = changer AI_PROVIDER dans Vercel, sans toucher au code.
const PROVIDER = (process.env.AI_PROVIDER ?? "anthropic").toLowerCase();

type Result = { text: string; model: string; inputTokens: number; outputTokens: number };

async function viaAnthropic(tier: Tier, system: string, messages: ChatMessage[], maxTokens: number): Promise<Result> {
  const model = MODELS[tier];
  const anthropic = new Anthropic(); // lit ANTHROPIC_API_KEY
  const res = await anthropic.messages.create({ model, max_tokens: maxTokens, system, messages });
  // La réponse peut contenir des blocs de "réflexion" : on ne garde que le texte.
  const text = res.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("\n");
  return { text, model, inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens };
}

async function viaOpenAI(tier: Tier, system: string, messages: ChatMessage[], maxTokens: number): Promise<Result> {
  // Un modèle par niveau, réglé dans les variables d'environnement.
  const model = tier === "haiku" ? process.env.OPENAI_MODEL_SMALL ?? process.env.OPENAI_MODEL : process.env.OPENAI_MODEL;
  if (!model) throw new Error("OPENAI_MODEL manquant");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model,
      max_completion_tokens: maxTokens,
      messages: [{ role: "system", content: system }, ...messages],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`OpenAI ${res.status} : ${data?.error?.message ?? "erreur"}`);
  return {
    text: data.choices?.[0]?.message?.content ?? "",
    model,
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
  };
}

/**
 * Point de passage UNIQUE vers l'IA.
 * Tout appel IA de l'app doit passer par ici : c'est ce qui garantit
 * que chaque appel est journalisé avec son coût dans la table ai_calls,
 * et qu'on peut changer de fournisseur sans casser le reste.
 */
export async function callAI(opts: {
  tier: Tier; // "sonnet" = raisonnement, "haiku" = petites tâches
  system: string;
  messages: ChatMessage[];
  purpose: string; // ex. "chat", "briefing", "tri-mail"
  maxTokens?: number;
}): Promise<string> {
  const started = Date.now();
  const maxTokens = opts.maxTokens ?? 2048;
  const r =
    PROVIDER === "openai"
      ? await viaOpenAI(opts.tier, opts.system, opts.messages, maxTokens)
      : await viaAnthropic(opts.tier, opts.system, opts.messages, maxTokens);

  // Journalisation : si elle échoue, on ne bloque pas la réponse.
  try {
    const { error } = await supabaseAdmin().from("ai_calls").insert({
      model: r.model,
      purpose: opts.purpose,
      input_tokens: r.inputTokens,
      output_tokens: r.outputTokens,
      cost_usd: estimateCostUsd(r.model, r.inputTokens, r.outputTokens),
      duration_ms: Date.now() - started,
    });
    if (error) console.error("Journalisation ai_calls échouée :", error.message);
  } catch (err) {
    console.error("Journalisation ai_calls échouée :", err);
  }

  return r.text;
}
