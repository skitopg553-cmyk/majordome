import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeMoreTool } from "./more-tools";
import { extractUndo, parseUndoSteps } from "./undo";

// Faux client Supabase en mémoire : assez pour tester les outils sans base ni réseau.
type R = Record<string, unknown>;
const h = vi.hoisted(() => ({ tables: {} as Record<string, R[]>, nextId: 100 }));
vi.mock("./supabase", async (orig) => ({
  ...(await orig<typeof import("./supabase")>()),
  supabaseAdmin: () => ({
    from(name: string) {
      const rows = (h.tables[name] ??= []);
      const q: { op: string; filters: [string, unknown][]; values: R; key?: string; single: boolean; maybe: boolean } = { op: "select", filters: [], values: {}, single: false, maybe: false };
      const run = () => {
        const match = rows.filter((r) => q.filters.every(([k, v]) => r[k] === v));
        if (q.op === "insert") {
          const row = { id: h.nextId++, ...q.values };
          rows.push(row);
          return { data: q.single ? row : [row], error: null };
        }
        if (q.op === "upsert") {
          const hit = rows.find((r) => r[q.key!] === q.values[q.key!]);
          const row = hit ? Object.assign(hit, q.values) : (rows.push({ id: h.nextId++, ...q.values }), rows[rows.length - 1]);
          return { data: q.single ? row : [row], error: null };
        }
        if (q.op === "update") match.forEach((r) => Object.assign(r, q.values));
        if (q.op === "delete") match.forEach((r) => rows.splice(rows.indexOf(r), 1));
        const copy = (r: R) => ({ ...r }); // comme une vraie base : on lit des copies, pas les lignes elles-mêmes
        if (q.maybe || q.single) return { data: match[0] ? copy(match[0]) : null, error: q.single && !match[0] ? { message: "no row" } : null };
        return { data: match.map(copy), error: null };
      };
      const b: Record<string, unknown> = {
        select: () => b,
        insert: (v: R) => ((q.op = "insert"), (q.values = v), b),
        update: (v: R) => ((q.op = "update"), (q.values = v), b),
        delete: () => ((q.op = "delete"), b),
        upsert: (v: R, o: { onConflict: string }) => ((q.op = "upsert"), (q.values = v), (q.key = o.onConflict), b),
        eq: (k: string, v: unknown) => (q.filters.push([k, v]), b),
        gte: () => b,
        order: () => b,
        limit: () => b,
        single: () => ((q.single = true), b),
        maybeSingle: () => ((q.maybe = true), b),
        then: (res: (v: unknown) => unknown) => Promise.resolve(run()).then(res),
      };
      return b;
    },
  }),
}));

const call = async (name: string, args: R) => JSON.parse(await executeMoreTool(name, args) as string);

beforeEach(() => {
  h.nextId = 100;
  h.tables = {
    savings_goals: [
      { id: 1, label: "Voiture", target: 3000, saved: 400, due_label: "Juin" },
      { id: 2, label: "Vacances été", target: 1000, saved: 0, due_label: null },
      { id: 3, label: "Vacances hiver", target: 800, saved: 100, due_label: null },
    ],
    transactions: [{ id: 7, date: "2026-10-10", label: "Netflix", amount: -14, category: "Abonnements", import_key: "k1" }],
    budgets: [{ id: 4, category: "Sport & santé", monthly_limit: 50 }],
    sleep_logs: [{ id: 5, date: "2026-10-15", hours: 7 }],
  };
});

describe("add_to_goal", () => {
  it("fait avancer l'objectif au nom approximatif, avec de quoi annuler", async () => {
    const r = await call("add_to_goal", { goal: "la voiture", amount: 200 });
    expect(r.ok).toBe(true);
    expect(r.saved).toMatchObject({ goal: "Voiture", epargne_total: 600, reste: 2400 });
    expect(h.tables.savings_goals[0].saved).toBe(600);
    expect(r.undo.steps).toEqual([{ op: "restore", table: "savings_goals", id: 1, values: { saved: 400 } }]);
  });
  it("ambigu : ne touche à rien et dit lesquels", async () => {
    const r = await call("add_to_goal", { goal: "vacances", amount: 100 });
    expect(r.ok).toBe(false);
    expect(r.error).toContain("Vacances été");
    expect(r.error).toContain("Vacances hiver");
    expect(h.tables.savings_goals.map((g) => g.saved)).toEqual([400, 0, 100]);
  });
  it("inconnu, montant nul, retrait trop grand", async () => {
    expect((await call("add_to_goal", { goal: "moto", amount: 10 })).error).toContain("aucun objectif");
    expect((await call("add_to_goal", { goal: "voiture", amount: 0 })).ok).toBe(false);
    expect((await call("add_to_goal", { goal: "voiture", amount: -500 })).ok).toBe(false);
    expect((await call("add_to_goal", { goal: "voiture", amount: -100 })).saved.epargne_total).toBe(300);
  });
});

describe("log_food", () => {
  it("le code calcule : 50 g de riz", async () => {
    const r = await call("log_food", { food: "riz", quantity: 50, unit: "g" });
    expect(r.ok).toBe(true);
    expect(r.saved).toMatchObject({ aliment: "Riz blanc cuit", grammes: 50, kcal: 65, estime: false });
    expect(r.total_du_jour.kcal).toBe(65);
    expect(h.tables.food_logs).toHaveLength(1);
    expect(h.tables.food_logs[0]).toMatchObject({ kcal: 65, estimated: 0 });
  });
  it("aliment inconnu : refus sans estimation (rien d'écrit), « estimé » avec estimation", async () => {
    expect((await call("log_food", { food: "gâteau maison de Mamie", quantity: 100 })).ok).toBe(false);
    expect(h.tables.food_logs ?? []).toHaveLength(0);
    const r = await call("log_food", { food: "gâteau maison de Mamie", quantity: 100, estimate_per_100g: { kcal: 350, protein: 5, carbs: 50, fat: 15 } });
    expect(r.saved.estime).toBe(true);
    expect(h.tables.food_logs[0]).toMatchObject({ estimated: 1, kcal: 350 });
  });
});

describe("set_nutrition_goals", () => {
  it("objectif : crée puis ne change que les champs donnés", async () => {
    await call("set_nutrition_goals", { kcal: 2200, protein: 140 });
    await call("set_nutrition_goals", { protein: 150 });
    expect(h.tables.nutrition_goals).toHaveLength(1);
    expect(h.tables.nutrition_goals[0]).toMatchObject({ id: 1, kcal: 2200, protein: 150 });
    expect((await call("set_nutrition_goals", { kcal: 10 })).ok).toBe(false);
  });
});

describe("update_*", () => {
  it("update_transaction : seuls les champs donnés changent, annulable", async () => {
    const r = await call("update_transaction", { id: 7, amount: -17.99 });
    expect(r.ok).toBe(true);
    expect(h.tables.transactions[0]).toMatchObject({ label: "Netflix", amount: -17.99, category: "Abonnements", date: "2026-10-10" });
    expect(parseUndoSteps(r.undo.steps)).not.toBeNull();
    expect(r.undo.steps[0].values.amount).toBe(-14);
  });
  it("catégorie inconnue ou id absent : refusé", async () => {
    expect((await call("update_transaction", { id: 7, category: "Zzz" })).ok).toBe(false);
    expect((await call("update_transaction", { id: 999, amount: -1 })).error).toBe("id introuvable");
    expect(h.tables.transactions[0].amount).toBe(-14);
  });
});

describe("delete_entry : supprime et permet d'annuler", () => {
  it("opération par id : l'annulation recrée la ligne avec sa clé d'import", async () => {
    const r = await call("delete_entry", { kind: "transaction", id: 7 });
    expect(r.ok).toBe(true);
    expect(h.tables.transactions).toHaveLength(0);
    const steps = parseUndoSteps(r.undo.steps)!;
    expect(steps).toEqual([{ op: "insert", table: "transactions", values: { date: "2026-10-10", label: "Netflix", amount: -14, category: "Abonnements", import_key: "k1" } }]);
  });
  it("par date (nuit), par catégorie (budget, sans accents ni casse), par nom (objectif)", async () => {
    expect((await call("delete_entry", { kind: "sleep", date: "2026-10-15" })).ok).toBe(true);
    expect(h.tables.sleep_logs).toHaveLength(0);
    expect((await call("delete_entry", { kind: "budget", category: "sport & sante" })).ok).toBe(true);
    expect(h.tables.budgets).toHaveLength(0);
    expect((await call("delete_entry", { kind: "goal", label: "voiture" })).ok).toBe(true);
    expect(h.tables.savings_goals.map((g) => g.id)).toEqual([2, 3]);
  });
  it("objectif ambigu, introuvable, type ou id invalide : rien n'est supprimé", async () => {
    expect((await call("delete_entry", { kind: "goal", label: "vacances" })).error).toContain("plusieurs");
    expect((await call("delete_entry", { kind: "transaction", id: 999 })).ok).toBe(false);
    expect((await call("delete_entry", { kind: "ai_calls", id: 1 })).ok).toBe(false);
    expect((await call("delete_entry", { kind: "transaction", id: "7; drop" })).ok).toBe(false);
    expect((await call("delete_entry", { kind: "sleep", date: "hier" })).ok).toBe(false);
    expect(h.tables.transactions).toHaveLength(1);
    expect(h.tables.savings_goals).toHaveLength(3);
  });
  it("le résultat passe par extractUndo (l'écran reçoit l'undo, pas le modèle)", async () => {
    const raw = (await executeMoreTool("delete_entry", { kind: "transaction", id: 7 })) as string;
    const { result, undo } = extractUndo(raw);
    expect(undo?.label).toContain("Netflix");
    expect(JSON.parse(result).undo).toBeUndefined();
  });
});

it("outil inconnu : null (laisse la main aux autres)", async () => {
  expect(await executeMoreTool("autre_chose", {})).toBeNull();
});

describe("set_setting", () => {
  it("renvoie le réglage pour l'écran ; refuse tout autre réglage", async () => {
    expect(await call("set_setting", { name: "read_aloud", value: false })).toEqual({ ok: true, setting: { name: "read_aloud", value: false } });
    expect((await call("set_setting", { name: "code_acces", value: true })).ok).toBe(false);
    expect((await call("set_setting", { name: "read_aloud", value: "non" })).ok).toBe(false);
  });
});
