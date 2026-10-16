import Anthropic from "@anthropic-ai/sdk";
import { after } from "next/server";
import { estimateCostUsd, MODELS } from "./models";
import { supabaseAdmin } from "./supabase";
import type { ToolDef } from "./tools";

type ChatMessage = { role: "user" | "assistant"; content: string; images?: string[] }; // images : data URLs (capture d'écran lue par vision)
type Tier = "sonnet" | "haiku";
type Exec = (name: string, args: Record<string, unknown>) => Promise<string>;
type Log = (model: string, inputTokens: number, outputTokens: number, startedAt: number) => void;
export type Timing = (label: string, ms: number) => void;
type Text = (delta: string) => void;

// Fournisseur choisi par variable d'environnement : "anthropic" (défaut) ou "openai".
// Basculer = changer AI_PROVIDER dans Vercel, sans toucher au code.
const PROVIDER = (process.env.AI_PROVIDER ?? "anthropic").toLowerCase();

// Garde-fou : nombre max d'allers-retours modèle ↔ outils pour un seul message.
const MAX_STEPS = 6;
const GAVE_UP = "Je n'ai pas réussi à terminer cette demande (trop d'étapes).";

/** Lit un flux SSE OpenAI ("data: {...}" ligne par ligne) et appelle onEvent pour chaque objet JSON. */
async function readSse(body: ReadableStream<Uint8Array>, onEvent: (data: any) => void) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const reader = body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const data = line.startsWith("data:") ? line.slice(5).trim() : "";
      if (data && data !== "[DONE]") onEvent(JSON.parse(data));
    }
  }
}

async function openaiLoop(tier: Tier, system: string, messages: ChatMessage[], tools: ToolDef[], exec: Exec, maxTokens: number, log: Log, time: Timing, text: Text) {
  const model = tier === "haiku" ? process.env.OPENAI_MODEL_SMALL ?? process.env.OPENAI_MODEL : process.env.OPENAI_MODEL;
  if (!model) throw new Error("OPENAI_MODEL manquant");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const msgs: any[] = [{ role: "system", content: system }, ...messages.map((m) => (m.images?.length ? { role: m.role, content: [{ type: "text", text: m.content }, ...m.images.map((url) => ({ type: "image_url", image_url: { url } }))] } : { role: m.role, content: m.content }))];

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
        stream: true,
        stream_options: { include_usage: true },
      }),
    });
    if (!res.ok || !res.body) {
      const data = await res.json().catch(() => null);
      throw new Error(`OpenAI ${res.status} : ${data?.error?.message ?? "erreur"}`);
    }

    // Le texte part au fil de l'eau ; les appels d'outils sont reconstitués morceau par morceau.
    let content = "";
    const calls: { id: string; type: "function"; function: { name: string; arguments: string } }[] = [];
    let usage = { prompt_tokens: 0, completion_tokens: 0 };
    await readSse(res.body, (chunk) => {
      if (chunk.usage) usage = chunk.usage;
      const delta = chunk.choices?.[0]?.delta;
      if (delta?.content) {
        content += delta.content;
        text(delta.content);
      }
      for (const tc of delta?.tool_calls ?? []) {
        const c = (calls[tc.index] ??= { id: "", type: "function", function: { name: "", arguments: "" } });
        if (tc.id) c.id = tc.id;
        if (tc.function?.name) c.function.name += tc.function.name;
        if (tc.function?.arguments) c.function.arguments += tc.function.arguments;
      }
    });
    time(`ia${step}`, Date.now() - startedAt);
    log(model, usage.prompt_tokens, usage.completion_tokens, startedAt);

    if (!calls.length) return;

    msgs.push({ role: "assistant", content: content || null, tool_calls: calls });
    for (const call of calls) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function.arguments || "{}");
      } catch {
        /* arguments invalides : l'outil renverra une erreur */
      }
      const t0 = Date.now();
      msgs.push({ role: "tool", tool_call_id: call.id, content: await exec(call.function.name, args) });
      time(`outil_${call.function.name}`, Date.now() - t0);
    }
  }
  text(GAVE_UP);
}

async function anthropicLoop(tier: Tier, system: string, messages: ChatMessage[], tools: ToolDef[], exec: Exec, maxTokens: number, log: Log, time: Timing, text: Text) {
  const model = MODELS[tier];
  const anthropic = new Anthropic(); // lit ANTHROPIC_API_KEY
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const msgs: any[] = messages.map((m) => ({
    role: m.role,
    content: m.images?.length
      ? [...m.images.map((url) => ({ type: "image", source: { type: "base64", media_type: url.slice(5, url.indexOf(";")), data: url.slice(url.indexOf(",") + 1) } })), { type: "text", text: m.content }]
      : m.content,
  }));

  for (let step = 0; step < MAX_STEPS; step++) {
    const startedAt = Date.now();
    const stream = anthropic.messages.stream({
      model,
      max_tokens: maxTokens,
      system,
      messages: msgs,
      tools: tools.length
        ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
          tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters as any }))
        : undefined,
    });
    stream.on("text", text);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res: any = await stream.finalMessage();
    time(`ia${step}`, Date.now() - startedAt);
    log(model, res.usage.input_tokens, res.usage.output_tokens, startedAt);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const blocks: any[] = res.content;
    const toolUses = blocks.filter((b) => b.type === "tool_use");
    if (res.stop_reason !== "tool_use" || !toolUses.length) return;

    msgs.push({ role: "assistant", content: blocks }); // renvoyé tel quel (y compris la réflexion)
    const results = [];
    for (const t of toolUses) {
      const t0 = Date.now();
      results.push({ type: "tool_result", tool_use_id: t.id, content: await exec(t.name, t.input ?? {}) });
      time(`outil_${t.name}`, Date.now() - t0);
    }
    msgs.push({ role: "user", content: results });
  }
  text(GAVE_UP);
}

/**
 * Point de passage UNIQUE vers l'IA.
 * Gère la boucle d'outils, journalise chaque appel modèle (coût) dans ai_calls,
 * et permet de changer de fournisseur sans casser le reste.
 * Le texte est transmis mot par mot via onText ; la promesse renvoie le texte complet.
 */
export async function runAgent(opts: {
  tier: Tier; // "sonnet" = raisonnement, "haiku" = petites tâches
  system: string;
  messages: ChatMessage[];
  purpose: string; // ex. "chat", "briefing", "tri-mail"
  tools?: ToolDef[];
  executeTool?: Exec;
  maxTokens?: number;
  onTiming?: Timing; // chronométrage (ms) des appels modèle et des outils
  onText?: Text; // reçoit la réponse au fil de l'eau (streaming)
}): Promise<string> {
  const tools = opts.tools ?? [];
  const exec: Exec = opts.executeTool ?? (async () => JSON.stringify({ ok: false, error: "aucun outil" }));
  const maxTokens = opts.maxTokens ?? 2048;
  const time: Timing = opts.onTiming ?? (() => {});

  // Texte complet + séparation propre si le modèle parle avant ET après un outil.
  let full = "";
  let stepHadText = false;
  const startStep = () => (stepHadText = false);
  const text: Text = (d) => {
    if (!stepHadText && full) {
      full += "\n\n";
      opts.onText?.("\n\n");
    }
    stepHadText = true;
    full += d;
    opts.onText?.(d);
  };
  const timeAndReset: Timing = (label, ms) => {
    if (label.startsWith("ia")) startStep();
    time(label, ms);
  };

  // Claude exige que la conversation commence par un message de l'utilisateur.
  const messages = [...opts.messages];
  while (messages.length && messages[0].role !== "user") messages.shift();

  const insert = async (row: Record<string, unknown>) => {
    try {
      const { error } = await supabaseAdmin().from("ai_calls").insert(row);
      if (error) console.error("Journalisation ai_calls échouée :", error.message);
    } catch (err) {
      console.error("Journalisation ai_calls échouée :", err);
    }
  };
  // L'insert part après l'envoi de la réponse (after) pour ne pas la ralentir.
  // Hors requête (tâche planifiée), after() n'existe pas : on attend simplement l'insert.
  const log: Log = (model, inputTokens, outputTokens, startedAt) => {
    const row = {
      model,
      purpose: opts.purpose,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: estimateCostUsd(model, inputTokens, outputTokens),
      duration_ms: Date.now() - startedAt,
    };
    try {
      after(() => insert(row));
    } catch {
      void insert(row);
    }
  };

  await (PROVIDER === "openai"
    ? openaiLoop(opts.tier, opts.system, messages, tools, exec, maxTokens, log, timeAndReset, text)
    : anthropicLoop(opts.tier, opts.system, messages, tools, exec, maxTokens, log, timeAndReset, text));
  return full;
}
