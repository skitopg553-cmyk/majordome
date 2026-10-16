// Enregistrement des opérations : UN SEUL chemin pour l'import CSV / Excel et la synchro bancaire (mêmes catégories, mêmes règles).
// 1) on écarte ce qui est déjà en base (clé anti-doublon) ; 2) règles en code ; 3) l'IA (Haiku) seulement pour les libellés inconnus ; 4) enregistrement.
import { runAgent } from "../ai";
import { isMissingTable, supabaseAdmin } from "../supabase";
import { ambiguousPrompt, categorizeByRules, parseAmbiguousReply } from "./categorize";
import type { IngestItem } from "./bank";

const MAX_AMBIGUOUS = 40; // au-delà, « Autre » : on borne le coût de l'appel Haiku
const PAGE = 1000; // Supabase renvoie au plus 1000 lignes par requête
const MAX_PAGES = 50;

export type IngestResult = { ok: true; imported: number; duplicates: number; viaAi: number } | { ok: false; status: 500 | 503; error: string };

type Db = ReturnType<typeof supabaseAdmin>;
type KeysResult = { keys: Set<string>; error?: { code?: string; message: string } };

/**
 * Clés déjà en base pour la période des opérations reçues. On lit PAR PLAGE DE DATES et on compare en code : on ne met JAMAIS un libellé
 * dans un filtre `.in(...)` (un libellé avec des guillemets ou des virgules, comme « Burger "King", Fries », cassait la requête : l'import entier échouait).
 */
export async function loadExistingKeys(db: Db, from: string, to: string): Promise<KeysResult> {
  const keys = new Set<string>();
  for (let page = 0; page < MAX_PAGES; page++) {
    const r = await db.from("transactions").select("import_key").gte("date", from).lte("date", to).order("id").range(page * PAGE, page * PAGE + PAGE - 1);
    if (r.error) return { keys, error: r.error };
    for (const row of r.data ?? []) keys.add(row.import_key);
    if ((r.data?.length ?? 0) < PAGE) break;
  }
  return { keys };
}

export async function ingestTransactions(items: IngestItem[], db: Db = supabaseAdmin()): Promise<IngestResult> {
  // Clés déjà en base : on ne les catégorise pas (pas d'appel IA inutile) et on ne les réécrit pas.
  const dates = items.map((x) => x.date).sort();
  const { keys: existing, error: keysError } = await loadExistingKeys(db, dates[0], dates[dates.length - 1]);
  if (isMissingTable(keysError ?? null)) return { ok: false, status: 503, error: "Les tables Finances ne sont pas encore créées (migration 0004 à valider)." };
  if (keysError) return { ok: false, status: 500, error: keysError.message };
  const fresh = items.filter((x) => !existing.has(x.key));
  if (!fresh.length) return { ok: true, imported: 0, duplicates: items.length, viaAi: 0 };

  const byRules = fresh.map((t) => categorizeByRules(t.label));
  const unknown = [...new Set(fresh.filter((_, i) => !byRules[i]).map((t) => t.label))].slice(0, MAX_AMBIGUOUS);
  const aiCategory = new Map<string, string>();
  if (unknown.length) {
    try {
      const reply = await runAgent({
        tier: "haiku",
        system: "Tu classes des opérations bancaires. Tu réponds uniquement en JSON.",
        messages: [{ role: "user", content: ambiguousPrompt(unknown) }],
        purpose: "categorisation",
        maxTokens: 800,
      });
      parseAmbiguousReply(reply, unknown.length).forEach((c, i) => aiCategory.set(unknown[i], c));
    } catch (err) {
      console.error("Catégorisation Haiku échouée, repli sur « Autre » :", err instanceof Error ? err.message : err);
    }
  }

  const rows = fresh.map((t, i) => ({ date: t.date, label: t.label, amount: t.amount, category: byRules[i] ?? aiCategory.get(t.label) ?? "Autre", import_key: t.key }));
  const { data, error } = await db.from("transactions").upsert(rows, { onConflict: "import_key", ignoreDuplicates: true }).select("id");
  if (error) return { ok: false, status: 500, error: error.message };
  const imported = data?.length ?? 0;
  return { ok: true, imported, duplicates: items.length - imported, viaAi: unknown.length };
}
