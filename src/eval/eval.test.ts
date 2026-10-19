import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CASES } from "./cases";
import { WEEK_INPUTS } from "./memory-tools";
import { scoreCase, summarize, type Item } from "./score";

const byId = (id: string) => CASES.find((c) => c.id === id)!;

describe("jeu de phrases", () => {
  it("au moins 30 phrases, identifiants uniques, les cas demandés sont là", () => {
    expect(CASES.length).toBeGreaterThanOrEqual(30);
    expect(new Set(CASES.map((c) => c.id)).size).toBe(CASES.length);
    for (const id of ["semaine-reelle", "semaine-deux-fois", "supprime-tout", "decale-boxe", "supprime-cours-mardi-aprem", "rec-boxe-sans-fin", "one-dentiste-jeudi", "pb-poubelles"]) expect(byId(id)).toBeDefined();
  });
});

describe("scoreCase", () => {
  it("état exact attendu, dans n'importe quel ordre ; rien en trop", () => {
    const c = byId("melange");
    const ok: Item[] = [
      { kind: "pensebete", title: "Ranger ma chambre" },
      { kind: "creneau_recurrent", title: "Salle", days: "1,3,5", start: "18:00", end: "20:00", habit: true },
      { kind: "creneau_recurrent", title: "Travail", days: "1,2,3,4,5", start: "09:00", end: "17:00", habit: false },
      { kind: "creneau", title: "Dîner avec Arthur", date: "2026-10-19", start: "20:00", end: "22:00" },
    ];
    expect(scoreCase(c, ok, "OK").pass).toBe(true);
    expect(scoreCase(c, [...ok, { kind: "pensebete", title: "Autre" }], "OK").why).toMatch(/en trop/);
    expect(scoreCase(c, ok.slice(1), "OK").why).toMatch(/manque : pensebete/);
  });
  it("question : rien ne doit avoir changé, et un « ? » dans la réponse", () => {
    const c = byId("rec-boxe-sans-fin");
    expect(scoreCase(c, [], "Jusqu'à quelle heure ?").pass).toBe(true);
    expect(scoreCase(c, [], "D'accord.").pass).toBe(false);
    expect(scoreCase(c, [{ kind: "creneau", title: "Boxe", date: "2026-10-19", start: "18:30" }], "Jusqu'à quelle heure ?").pass).toBe(false);
  });
  it("message attendu (compteur juste)", () => {
    expect(scoreCase(byId("supprime-tout"), [], "J'ai supprimé 13 événements et 1 pense-bête.").pass).toBe(true);
    expect(scoreCase(byId("supprime-tout"), [], "Tout est supprimé.").pass).toBe(false);
  });
  it("summarize", () => {
    expect(summarize([{ id: "a", pass: true, why: "" }, { id: "b", pass: false, why: "x" }])).toMatchObject({ passed: 1, total: 2, failed: [{ id: "b" }] });
  });
});

// Chaîne complète avec un FAUX modèle (aucun appel payant) : vrais outils, vrai planificateur, base en mémoire.
const sse = (events: unknown[]) => new Response(new ReadableStream({ start(c) { for (const e of events) c.enqueue(new TextEncoder().encode(`data: ${typeof e === "string" ? e : JSON.stringify(e)}\n\n`)); c.close(); } }));
const calls = (...cs: [string, unknown][]) => sse([{ choices: [{ delta: { tool_calls: cs.map(([name, args], index) => ({ index, id: `c${index}`, function: { name, arguments: JSON.stringify(args) } })) } }] }, { usage: { prompt_tokens: 10, completion_tokens: 5 } }, "[DONE]"]);
const say = (t: string) => sse([{ choices: [{ delta: { content: t } }] }, { usage: { prompt_tokens: 10, completion_tokens: 5 } }, "[DONE]"]);
const script = (...replies: Response[]) => vi.stubGlobal("fetch", async () => replies.shift() ?? say("OK"));
const weekCalls = (): [string, unknown][] => WEEK_INPUTS.filter((w) => !/tacos/i.test(w.title)).map((w) => ["add_event", w]);

describe("harnais de l'évaluation, avec un faux modèle", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("AI_PROVIDER", "openai");
    vi.stubEnv("OPENAI_MODEL", "faux");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
  const run = async (id: string) => (await import("./run-case")).runCase(byId(id));

  it("semaine réelle : un bon modèle crée les 11 pavés et demande la fin d'O'Tacos → réussi", async () => {
    script(calls(...weekCalls()), say("OK. Jusqu'à quelle heure tu travailles au O'Tacos ?"));
    const r = await run("semaine-reelle");
    expect(r.why).toBe("");
    expect(r.pass).toBe(true);
  });
  it("le comportement du 19/10 (une tâche par jour et par heure, sans fin) → raté", async () => {
    script(calls(["add_task", { title: "Cours le lundi", due_at: "2026-10-19T09:00:00+02:00" }], ["add_task", { title: "Fin de cours le lundi", due_at: "2026-10-19T18:00:00+02:00" }]), say("Tout est noté !"));
    expect((await run("semaine-reelle")).pass).toBe(false);
  });
  it("la même description envoyée deux fois : le code empêche les doublons", async () => {
    script(calls(...weekCalls()), say("Jusqu'à quelle heure au O'Tacos ?"), calls(...weekCalls()), say("Jusqu'à quelle heure au O'Tacos ?"));
    const r = await run("semaine-deux-fois");
    expect(r.why).toBe("");
    expect(r.pass).toBe(true);
  });
  it("« supprime tout » : la carte est confirmée, compteur exact écrit par le code", async () => {
    script(calls(["delete_many", { scope: "all" }]), say("OK"));
    const r = await run("supprime-tout");
    expect(r.reply).toMatch(/J'ai supprimé 13 événements et 1 pense-bête\./);
    expect(r.pass).toBe(true);
  });
  it("« décale la boxe à 19 h » et « supprime le cours de mardi après-midi juste cette semaine »", async () => {
    script(calls(["update_event", { title: "boxe", new_start: "19:00" }]), say("OK"));
    expect((await run("decale-boxe")).pass).toBe(true);
    script(calls(["delete_event", { title: "cours", day: "mardi", at: "après-midi", scope: "once" }]), say("OK"));
    expect((await run("supprime-cours-mardi-aprem")).pass).toBe(true);
  });
  it("« j'ai boxe à 18 h 30 » : le code refuse sans fin, l'IA pose la question → réussi", async () => {
    script(calls(["add_event", { title: "Boxe", day: "aujourd'hui", start: "18:30" }]), say("Jusqu'à quelle heure ?"));
    expect((await run("rec-boxe-sans-fin")).pass).toBe(true);
  });
  it("une IA qui ment (« tout est supprimé » après une erreur) → raté", async () => {
    script(calls(["delete_event", { title: "tout", scope: "series" }]), say("Tout est maintenant supprimé."));
    expect((await run("supprime-tout")).pass).toBe(false);
  });
});
