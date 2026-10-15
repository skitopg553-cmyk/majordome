import Anthropic from "@anthropic-ai/sdk";
import { estimateCostUsd, MODELS } from "./models";
import { supabaseAdmin } from "./supabase";
import type { ToolDef } from "./tools";

type ChatMessage = { role: "user" | "assistant"; content: string };
type Tier = "sonnet" | "haiku";
type Exec = (name: string, args: Record<string, unknown>) => Promise<string>;
type Log = (model: string, inputTokens: number, outputTokens: number, startedAt: number) => Promise<void>;

// Fournisseur choisi par variable d'environnement : "anthropic" (défaut) ou "openai".
// Basculer = changer AI_PROVIDER dans Vercel, sans toucher au code.
const PROVIDER = (process.env.AI_PROVIDER ?? "anthropic").toLowerCase();

// Garde-fou : nombre max d'allers-retours modèle ↔ outils pour un seul message.
const MAX_STEPS = 6;
const GAVE_UP = "Je n'ai pas réussi à terminer cette demande (trop d'étapes).";

async function openaiLoop(tier: Tier, system: string, messages: ChatMessage[], tools: ToolDef[], exec: Exec, maxTokens: number, log: Log) {
  const model = tier === "haiku" ? process.env.OPENAI_MODEL_SMALL ?? process.env.OPENAI_MODEL : process.env.OPENAI_MODEL;
  if (!model) throw new Error("OPENAI_MODEL manquant");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const msgs: any[] = [{ role: "system", content: system }, ...messages];

  for (let step = 0; step < MAX_STEPS; step++) {
    const startedAt = Date.now();
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model,
        max_completion_tokens: maxTokens,
        messages: msgs,
        tools: tools.length ? tools.map((t) => ({ type: "function", function: t })) : undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`OpenAI ${res.status} : ${data?.error?.message ?? "erreur"}`);
    await log(model, data.usage?.prompt_tokens ?? 0, data.usage?.completion_tokens ?? 0, startedAt);

    const msg = data.choices?.[0]?.message;
    const calls = msg?.tool_calls ?? [];
    if (!calls.length) return (msg?.content as string) ?? "";

    msgs.push(msg);
    for (const call of calls) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function.arguments || "{}");
      } catch {
        /* arguments invalides : l'outil renverra une erreur */
      }
      msgs.push({ role: "tool", tool_call_id: call.id, content: await exec(call.function.name, args) });
    }
  }
  return GAVE_UP;
}

async function anthropicLoop(tier: Tier, system: string, messages: ChatMessage[], tools: ToolDef[], exec: Exec, maxTokens: number, log: Log) {
  const model = MODELS[tier];
  const anthropic = new Anthropic(); // lit ANTHROPIC_API_KEY
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const msgs: any[] = messages.map((m) => ({ role: m.role, content: m.content }));

  for (let step = 0; step < MAX_STEPS; step++) {
    const startedAt = Date.now();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res: any = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      system,
      messages: msgs,
      tools: tools.length
        ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
          tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters as any }))
        : undefined,
    });
    await log(model, res.usage.input_tokens, res.usage.output_tokens, startedAt);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const blocks: any[] = res.content;
    const toolUses = blocks.filter((b) => b.type === "tool_use");
    if (res.stop_reason !== "tool_use" || !toolUses.length) {
      return blocks.filter((b) => b.type === "text").map((b) => b.text).join("\n");
    }

    msgs.push({ role: "assistant", content: blocks }); // renvoyé tel quel (y compris la réflexion)
    const results = [];
    for (const t of toolUses) {
      results.push({ type: "tool_result", tool_use_id: t.id, content: await exec(t.name, t.input ?? {}) });
    }
    msgs.push({ role: "user", content: results });
  }
  return GAVE_UP;
}

/**
 * Point de passage UNIQUE vers l'IA.
 * Gère la boucle d'outils, journalise chaque appel modèle (coût) dans ai_calls,
 * et permet de changer de fournisseur sans casser le reste.
 */
export async function runAgent(opts: {
  tier: Tier; // "sonnet" = raisonnement, "haiku" = petites tâches
  system: string;
  messages: ChatMessage[];
  purpose: string; // ex. "chat", "briefing", "tri-mail"
  tools?: ToolDef[];
  executeTool?: Exec;
  maxTokens?: number;
}): Promise<string> {
  const tools = opts.tools ?? [];
  const exec: Exec = opts.executeTool ?? (async () => JSON.stringify({ ok: false, error: "aucun outil" }));
  const maxTokens = opts.maxTokens ?? 2048;

  // Claude exige que la conversation commence par un message de l'utilisateur.
  const messages = [...opts.messages];
  while (messages.length && messages[0].role !== "user") messages.shift();

  const log: Log = async (model, inputTokens, outputTokens, startedAt) => {
    try {
      const { error } = await supabaseAdmin().from("ai_calls").insert({
        model,
        purpose: opts.purpose,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_usd: estimateCostUsd(model, inputTokens, outputTokens),
        duration_ms: Date.now() - startedAt,
      });
      if (error) console.error("Journalisation ai_calls échouée :", error.message);
    } catch (err) {
      console.error("Journalisation ai_calls échouée :", err);
    }
  };

  return PROVIDER === "openai"
    ? openaiLoop(opts.tier, opts.system, messages, tools, exec, maxTokens, log)
    : anthropicLoop(opts.tier, opts.system, messages, tools, exec, maxTokens, log);
}
