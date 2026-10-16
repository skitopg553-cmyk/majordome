import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { INSTRUCTIONS } from "./instructions";
import { TOOLS } from "./tools";

// Faux modèle : un faux serveur OpenAI (flux SSE) qui rejoue un scénario. Il vérifie la CHAÎNE (outils proposés, appel exécuté,
// résultat renvoyé au modèle), pas l'intelligence du vrai modèle : celle-ci est encadrée par instructions.ts et intents.ts.
const sse = (events: unknown[]) =>
  new Response(new ReadableStream({ start(c) { for (const e of events) c.enqueue(new TextEncoder().encode(`data: ${typeof e === "string" ? e : JSON.stringify(e)}\n\n`)); c.close(); } }));
const toolCall = (name: string, args: unknown) => sse([{ choices: [{ delta: { tool_calls: [{ index: 0, id: "call_1", function: { name, arguments: JSON.stringify(args) } }] } }] }, { usage: { prompt_tokens: 10, completion_tokens: 5 } }, "[DONE]"]);
const say = (text: string) => sse([{ choices: [{ delta: { content: text } }] }, { usage: { prompt_tokens: 10, completion_tokens: 5 } }, "[DONE]"]);

describe("l'agent appelle l'outil que le modèle choisit (faux modèle)", () => {
  let requests: { messages: { role: string; content?: string; tool_call_id?: string }[]; tools?: { function: { name: string } }[] }[];

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("AI_PROVIDER", "openai");
    vi.stubEnv("OPENAI_MODEL", "faux-modele");
    vi.spyOn(console, "error").mockImplementation(() => {}); // pas de base dans les tests : la journalisation ai_calls échoue, c'est attendu
    requests = [];
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  async function scenario(userText: string, tool: string, args: Record<string, unknown>, toolResult = { ok: true }) {
    const replies = [toolCall(tool, args), say("C'est fait.")];
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => (requests.push(JSON.parse(String(init.body))), replies.shift()!));
    const { runAgent } = await import("./ai");
    const calls: [string, Record<string, unknown>][] = [];
    const streamed: string[] = [];
    const reply = await runAgent({
      tier: "sonnet",
      system: INSTRUCTIONS,
      messages: [{ role: "user", content: userText }],
      purpose: "test",
      tools: TOOLS,
      executeTool: async (n, a) => (calls.push([n, a]), JSON.stringify(toolResult)),
      onText: (d) => streamed.push(d),
    });
    return { reply, calls, streamed };
  }

  it.each([
    ["retiens que je suis allergique aux arachides", "remember", { content: "Je suis allergique aux arachides", category: "info" }],
    ["mon objectif est de courir un semi-marathon", "remember", { content: "Courir un semi-marathon", category: "objectif" }],
    ["objectif 3000 € pour une voiture", "set_goal", { label: "Voiture", target: 3000 }],
    ["j'ai fait 2000 pas sans mon téléphone", "log_steps", { steps: 2000, mode: "add" }],
    ["j'ai fait une séance de muscu", "log_workout", { kind: "Musculation" }],
  ])("« %s » → %s", async (text, tool, args) => {
    const { reply, calls, streamed } = await scenario(text, tool, args);
    expect(calls).toEqual([[tool, args]]); // le bon outil, avec les bons arguments
    expect(reply).toBe("C'est fait.");
    expect(streamed.join("")).toBe("C'est fait.");
    // le modèle a bien reçu le résultat de l'outil avant de répondre
    const second = requests[1].messages;
    expect(second.find((m) => m.role === "tool")).toMatchObject({ tool_call_id: "call_1", content: JSON.stringify({ ok: true }) });
  });

  it("le modèle voit tous les outils d'écriture de l'app", async () => {
    await scenario("salut", "remember", { content: "x", category: "info" });
    const offered = requests[0].tools!.map((t) => t.function.name);
    for (const name of ["add_task", "remember", "set_goal", "log_workout", "log_sleep", "log_steps", "set_budget", "add_transaction"]) expect(offered).toContain(name);
  });

  it("une erreur d'outil est transmise au modèle (il peut alors le dire honnêtement)", async () => {
    const { calls } = await scenario("objectif 3000 € pour une voiture", "set_goal", { label: "Voiture", target: 3000 }, { ok: false, error: "table manquante" } as never);
    expect(calls).toHaveLength(1);
    expect(requests[1].messages.find((m) => m.role === "tool")?.content).toContain("table manquante");
  });
});

describe("description des outils et consignes (ce qui guide le vrai modèle)", () => {
  const tool = (n: string) => TOOLS.find((t) => t.name === n)!;
  it("remember et set_goal exigent leurs champs", () => {
    expect(tool("remember").parameters).toMatchObject({ required: ["content", "category"] });
    expect(tool("set_goal").parameters).toMatchObject({ required: ["label", "target"] });
  });
  it("la description de remember cite les phrases qui doivent le déclencher", () => {
    for (const phrase of ["retiens que", "n'oublie pas", "mon objectif est", "je veux"]) expect(tool("remember").description).toContain(phrase);
    expect(tool("set_goal").description).toMatch(/objectif d'épargne/i);
  });
  it("les consignes règlent le routage et interdisent le faux « c'est noté »", () => {
    expect(INSTRUCTIONS).toMatch(/Ne dis JAMAIS « j'ai noté/);
    for (const needle of ["retiens que", "mon objectif est", "je veux", "remember", "set_goal", "log_workout", "log_steps", "add_task", "Déjà fait pour Ruben dans ce message"]) expect(INSTRUCTIONS).toContain(needle);
  });
});
