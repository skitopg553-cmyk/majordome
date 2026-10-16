// Enregistrement des opérations : UN SEUL chemin pour l'import CSV / Excel et la synchro bancaire (mêmes catégories, mêmes règles).
// 1) on écarte ce qui est déjà en base (clé anti-doublon) ; 2) règles en code ; 3) l'IA (Haiku) seulement pour les libellés inconnus ; 4) enregistrement.
import { runAgent } from "../ai";
import { isMissingTable, supabaseAdmin } from "../supabase";
import { ambiguousPrompt, categorizeByRules, parseAmbiguousReply } from "./categorize";
import type { IngestItem } from "./bank";

const MAX_AMBIGUOUS = 40; // au-delà, « Autre » : on borne le coût de l'appel Haiku
const CHUNK = 150; // taille des paquets de clés interrogées (URL de requête limitée)

export type IngestResult = { ok: true; imported: number; duplicates: number; viaAi: number } | { ok: false; status: 500 | 503; error: string };

export async function ingestTransactions(items: IngestItem[]): Promise<IngestResult> {
  const db = supabaseAdmin();

  // Clés déjà en base : on ne les catégorise pas (pas d'appel IA inutile) et on ne les réécrit pas.
  const existing = new Set<string>();
  for (let i = 0; i < items.length; i += CHUNK) {
    const r = await db.from("transactions").select("import_key").in("import_key", items.slice(i, i + CHUNK).map((x) => x.key));
    if (isMissingTable(r.error)) return { ok: false, status: 503, error: "Les tables Finances ne sont pas encore créées (migration 0004 à valider)." };
    if (r.error) return { ok: false, status: 500, error: r.error.message };
    for (const row of r.data ?? []) existing.add(row.import_key);
  }
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
