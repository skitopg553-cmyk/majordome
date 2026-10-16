import { NextResponse } from "next/server";
import { denied } from "@/lib/access";
import { importKeys, parseBankCsv } from "@/lib/finance/csv";
import { ingestTransactions } from "@/lib/finance/ingest";
import { saveSnapshot } from "@/lib/finance/snapshot";
import { supabaseAdmin } from "@/lib/supabase";

const MAX_CSV = 2_000_000; // 2 Mo : un relevé de plusieurs années tient largement

// Import d'un relevé CSV / Excel (converti en CSV dans le navigateur) : lecture, puis le même enregistrement que la synchro bancaire.
// Réimporter le même fichier n'ajoute rien (clé anti-doublon).
export async function POST(req: Request) {
  if (denied(req)) return NextResponse.json({ error: "Accès refusé" }, { status: 401 });
  const { csv } = (await req.json().catch(() => ({}))) as { csv?: string };
  if (typeof csv !== "string" || !csv.trim()) return NextResponse.json({ error: "Fichier vide" }, { status: 400 });
  if (csv.length > MAX_CSV) return NextResponse.json({ error: "Fichier trop gros (2 Mo max)" }, { status: 413 });

  const parsed = parseBankCsv(csv);
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (!parsed.transactions.length) return NextResponse.json({ error: "Aucune opération lisible dans ce fichier" }, { status: 400 });

  const keys = importKeys(parsed.transactions);
  const r = await ingestTransactions(parsed.transactions.map((t, i) => ({ ...t, key: keys[i] })));
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  // Solde lu dans le fichier (Revolut : colonne Balance / Solde). Conservé si la table existe (migration 0010), sinon seulement affiché dans le message.
  const snap = parsed.balance ? await saveSnapshot(supabaseAdmin(), { balance: parsed.balance.amount, asOf: parsed.balance.date }) : null;
  return NextResponse.json({
    imported: r.imported,
    duplicates: r.duplicates,
    skipped: parsed.skipped,
    viaAi: r.viaAi,
    format: parsed.format,
    balance: parsed.balance ?? null,
    balanceSaved: snap?.saved ?? false,
    balanceTableMissing: snap?.missingTable ?? false,
  });
}
