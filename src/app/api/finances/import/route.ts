import { NextResponse } from "next/server";
import { denied } from "@/lib/access";
import { runAgent } from "@/lib/ai";
import { ambiguousPrompt, categorizeByRules, parseAmbiguousReply } from "@/lib/finance/categorize";
import { importKeys, parseBankCsv } from "@/lib/finance/csv";
import { isMissingTable, supabaseAdmin } from "@/lib/supabase";

const MAX_CSV = 2_000_000; // 2 Mo : un relevé de plusieurs années tient largement
const MAX_AMBIGUOUS = 40; // au-delà, « Autre » : on borne le coût de l'appel Haiku

// Import d'un relevé CSV : parsing + catégorisation (règles, puis Haiku pour les libellés inconnus) + enregistrement.
// Réimporter le même fichier n'ajoute rien (clé anti-doublon).
export async function POST(req: Request) {
  if (denied(req)) return NextResponse.json({ error: "Accès refusé" }, { status: 401 });
  const { csv } = (await req.json().catch(() => ({}))) as { csv?: string };
  if (typeof csv !== "string" || !csv.trim()) return NextResponse.json({ error: "Fichier vide" }, { status: 400 });
  if (csv.length > MAX_CSV) return NextResponse.json({ error: "Fichier trop gros (2 Mo max)" }, { status: 413 });

  const parsed = parseBankCsv(csv);
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (!parsed.transactions.length) return NextResponse.json({ error: "Aucune opération lisible dans ce fichier" }, { status: 400 });

  // Vérifie que la table existe AVANT de dépenser un appel IA.
  const db = supabaseAdmin();
  const probe = await db.from("transactions").select("id").limit(1);
  if (isMissingTable(probe.error)) {
    return NextResponse.json({ error: "Les tables Finances ne sont pas encore créées (migration 0004 à valider)." }, { status: 503 });
  }
  if (probe.error) return NextResponse.json({ error: probe.error.message }, { status: 500 });

  // 1) Règles en code. 2) Haiku, une seule fois, pour les libellés inconnus (dédoublonnés).
  const byRules = parsed.transactions.map((t) => categorizeByRules(t.label));
  const unknown = [...new Set(parsed.transactions.filter((_, i) => !byRules[i]).map((t) => t.label))].slice(0, MAX_AMBIGUOUS);
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
      console.error("Catégorisation Haiku échouée, repli sur « Autre » :", err);
    }
  }

  const keys = importKeys(parsed.transactions);
  const rows = parsed.transactions.map((t, i) => ({
    date: t.date,
    label: t.label,
    amount: t.amount,
    category: byRules[i] ?? aiCategory.get(t.label) ?? "Autre",
    import_key: keys[i],
  }));
  const { data, error } = await db.from("transactions").upsert(rows, { onConflict: "import_key", ignoreDuplicates: true }).select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ imported: data?.length ?? 0, duplicates: rows.length - (data?.length ?? 0), skipped: parsed.skipped, viaAi: unknown.length });
}
