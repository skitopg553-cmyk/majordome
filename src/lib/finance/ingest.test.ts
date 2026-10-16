import { describe, expect, it, vi } from "vitest";
import { loadExistingKeys } from "./ingest";

// Faux client de base de données : enregistre les filtres demandés, renvoie des pages prévues.
function fakeDb(pages: { import_key: string }[][], error: { code?: string; message: string } | null = null) {
  const calls: Record<string, unknown[]> = { gte: [], lte: [], range: [], in: [] };
  let i = 0;
  const b: Record<string, unknown> = {
    select: () => b,
    order: () => b,
    gte: (...a: unknown[]) => (calls.gte.push(a), b),
    lte: (...a: unknown[]) => (calls.lte.push(a), b),
    in: (...a: unknown[]) => (calls.in.push(a), b),
    range: (...a: unknown[]) => (calls.range.push(a), Promise.resolve({ data: error ? null : (pages[i++] ?? []), error })),
  };
  return { db: { from: vi.fn(() => b) } as never, calls };
}

describe("loadExistingKeys : lecture par plage de dates (aucun libellé dans un filtre)", () => {
  const tricky = ['2026-10-05|burger "king", fries|-12.50|1', "2026-10-05|resto (chez paul)|-20.00|1", "2026-10-05|l'été\\ ça va|-1.00|1", "eb|u1|ref-1"];

  it("reconnaît des clés pleines de guillemets, virgules, parenthèses et antislashs", async () => {
    const { db, calls } = fakeDb([tricky.map((import_key) => ({ import_key }))]);
    const r = await loadExistingKeys(db, "2026-10-01", "2026-10-31");
    expect(r.error).toBeUndefined();
    for (const k of tricky) expect(r.keys.has(k)).toBe(true);
    expect(calls.gte).toEqual([["date", "2026-10-01"]]);
    expect(calls.lte).toEqual([["date", "2026-10-31"]]);
    expect(calls.in).toEqual([]); // jamais de filtre .in : c'était la cause du bug
  });

  it("lit plusieurs pages tant qu'elles sont pleines (1000 lignes)", async () => {
    const full = Array.from({ length: 1000 }, (_, n) => ({ import_key: `k${n}` }));
    const { db, calls } = fakeDb([full, [{ import_key: "dernier" }]]);
    const r = await loadExistingKeys(db, "2026-01-01", "2026-12-31");
    expect(r.keys.size).toBe(1001);
    expect(calls.range).toEqual([[0, 999], [1000, 1999]]);
  });

  it("remonte l'erreur de la base (table absente, etc.)", async () => {
    const { db } = fakeDb([], { code: "42P01", message: "relation does not exist" });
    expect((await loadExistingKeys(db, "2026-01-01", "2026-01-31")).error?.code).toBe("42P01");
  });
});
