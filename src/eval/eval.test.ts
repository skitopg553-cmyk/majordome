import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CASES } from "./cases";
import { scoreCase, summarize, type Case, type Item } from "./score";

const byId = (id: string) => CASES.find((c) => c.id === id)!;
const slotItem = (o: Partial<Item>): Item => ({ kind: "creneau_recurrent", title: "Travail", days: "1,2,3,4,5", start: "09:00", end: "17:00", habit: false, ...o });

describe("jeu de phrases", () => {
  it("au moins 30 phrases, identifiants uniques, ma semaine type incluse", () => {
    expect(CASES.length).toBeGreaterThanOrEqual(30);
    expect(new Set(CASES.map((c) => c.id)).size).toBe(CASES.length);
    expect(CASES.some((c) => /tous les mardis/.test(c.say) && /Otacos|restaurant/i.test(c.say + CASES.map((x) => x.say).join(" ")))).toBe(true);
  });
});

describe("scoreCase", () => {
  it("réussit quand tout l'attendu est là, dans n'importe quel ordre", () => {
    const items: Item[] = [{ kind: "pensebete", title: "Ranger ma chambre" }, slotItem({ title: "Salle", days: "1,3,5", start: "18:00", end: "20:00", habit: true }), slotItem({}), { kind: "creneau", title: "Dîner avec Arthur", date: "2026-10-19", start: "20:00" }];
    expect(scoreCase(byId("melange"), items, "OK")).toEqual({ pass: true, why: "" });
  });
  it("échoue : un élément manque, mauvaise sorte, mauvais jour, mauvaise heure, habitude oubliée", () => {
    const base: Item[] = [{ kind: "pensebete", title: "Ranger ma chambre" }, slotItem({}), slotItem({ title: "Salle", days: "1,3,5", start: "18:00", end: "20:00", habit: true }), { kind: "creneau", title: "Dîner avec Arthur", date: "2026-10-19", start: "20:00" }];
    expect(scoreCase(byId("melange"), base.slice(1), "OK").why).toMatch(/manque : pensebete/);
    expect(scoreCase(byId("melange"), [{ ...base[0], kind: "creneau" }, ...base.slice(1)], "OK").pass).toBe(false);
    expect(scoreCase(byId("melange"), [base[0], slotItem({ days: "1" }), ...base.slice(2)], "OK").why).toMatch(/jours 1,2,3,4,5/);
    expect(scoreCase(byId("melange"), [base[0], slotItem({ start: "10:00" }), ...base.slice(2)], "OK").pass).toBe(false);
    expect(scoreCase(byId("melange"), [base[0], base[1], { ...base[2], habit: false }, base[3]], "OK").pass).toBe(false);
  });
  it("le problème du 19/10 : un élément par jour et par heure au lieu d'un créneau avec ses jours = raté", () => {
    const lundiSeulement: Item[] = [{ kind: "creneau", title: "Travail", date: "2026-10-19", start: "09:00" }];
    expect(scoreCase(byId("rec-travail"), lundiSeulement, "Tout est noté !").pass).toBe(false);
  });
  it("rien en trop (sauf extra autorisé)", () => {
    const c = byId("pb-chambre");
    expect(scoreCase(c, [{ kind: "pensebete", title: "Ranger ma chambre" }, { kind: "pensebete", title: "Autre" }], "OK").why).toMatch(/en trop/);
    const lax: Case = { id: "x", say: "", outcomes: [{ items: [{ kind: "pensebete", title: /chambre/ }], extra: "allow" }] };
    expect(scoreCase(lax, [{ kind: "pensebete", title: "Ranger ma chambre" }, { kind: "pensebete", title: "Autre" }], "OK").pass).toBe(true);
  });
  it("question : acceptée seulement si rien n'est créé ET que la réponse pose une question", () => {
    const c = byId("flou-truc");
    expect(scoreCase(c, [], "C'est quoi, ce truc ?").pass).toBe(true);
    expect(scoreCase(c, [], "D'accord.").pass).toBe(false);
    expect(scoreCase(c, [{ kind: "pensebete", title: "Truc" }], "Quoi ?").pass).toBe(false);
  });
  it("plusieurs résultats acceptables : l'un d'eux suffit", () => {
    const c = byId("flou-sport");
    expect(scoreCase(c, [{ kind: "pensebete", title: "Faire du sport" }], "OK").pass).toBe(true);
    expect(scoreCase(c, [], "Quel sport ?").pass).toBe(true);
  });
  it("summarize", () => {
    expect(summarize([{ id: "a", pass: true, why: "" }, { id: "b", pass: false, why: "x" }])).toMatchObject({ passed: 1, total: 2, failed: [{ id: "b" }] });
  });
});

// Chaîne complète avec un FAUX modèle (aucun appel payant) : le harnais lit bien les appels d'outils et note le résultat.
const sse = (events: unknown[]) => new Response(new ReadableStream({ start(c) { for (const e of events) c.enqueue(new TextEncoder().encode(`data: ${typeof e === "string" ? e : JSON.stringify(e)}\n\n`)); c.close(); } }));
const calls = (...cs: [string, unknown][]) => sse([{ choices: [{ delta: { tool_calls: cs.map(([name, args], index) => ({ index, id: `c${index}`, function: { name, arguments: JSON.stringify(args) } })) } }] }, { usage: { prompt_tokens: 10, completion_tokens: 5 } }, "[DONE]"]);
const say = (t: string) => sse([{ choices: [{ delta: { content: t } }] }, { usage: { prompt_tokens: 10, completion_tokens: 5 } }, "[DONE]"]);

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

  it("un bon modèle réussit ; un modèle qui ne crée que le lundi échoue", async () => {
    const good = [calls(["add_slot", { title: "Travail", days: ["lundi", "mardi", "mercredi", "jeudi", "vendredi"], start: "9h", end: "17h" }]), say("OK")];
    vi.stubGlobal("fetch", async () => good.shift()!);
    const { runCase } = await import("./run-case");
    const r = await runCase(byId("rec-travail"));
    expect(r.pass).toBe(true);
    expect(r.items).toEqual([{ kind: "creneau_recurrent", title: "Travail", days: "1,2,3,4,5", start: "09:00", end: "17:00", habit: false }]);

    const bad = [calls(["add_task", { title: "Travail", due_at: "2026-10-19T09:00:00+02:00" }]), say("Tout est noté !")];
    vi.stubGlobal("fetch", async () => bad.shift()!);
    const r2 = await runCase(byId("rec-travail"));
    expect(r2.pass).toBe(false);
  });

  it("jours invalides refusés par le code : l'IA reçoit l'erreur (et peut poser sa question)", async () => {
    const replies = [calls(["add_slot", { title: "Cours", days: ["souvent"], start: "9h" }]), say("Quels jours ?")];
    vi.stubGlobal("fetch", async () => replies.shift()!);
    const { runCase } = await import("./run-case");
    const r = await runCase(byId("flou-bosse"));
    expect(r.items).toEqual([]);
    expect(r.pass).toBe(true); // rien créé + question posée
  });

  it("plusieurs créations d'un coup : le récapitulatif est exact", async () => {
    const replies = [calls(["add_slot", { title: "Travail", days: ["lundi-vendredi"], start: "9h", end: "17h" }], ["add_slot", { title: "Salle", days: ["lundi", "mercredi", "vendredi"], start: "18h", end: "20h", habit: true }], ["add_task", { title: "Dîner avec Arthur", due_at: "2026-10-19T20:00:00+02:00" }]), say("OK")];
    vi.stubGlobal("fetch", async () => replies.shift()!);
    const { runCase } = await import("./run-case");
    const r = await runCase({ id: "t", say: "x", outcomes: [{ items: [], extra: "allow" }] });
    expect(r.recap).toBe("Noté :\n- Travail lundi-vendredi 9 h-17 h\n- Salle lundi, mercredi, vendredi 18 h-20 h (habitude à confirmer)\n- Dîner avec Arthur lundi 19 octobre 20 h, une seule fois");
  });
});
