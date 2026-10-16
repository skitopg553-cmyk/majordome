import { NextResponse } from "next/server";
import { denied } from "@/lib/access";
import { latestConnection, saveSync } from "@/lib/bank-store";
import { syncAccounts, syncSince } from "@/lib/bank-flow";
import * as eb from "@/lib/enable-banking";
import { daysLeft, totalBalance } from "@/lib/finance/bank";
import { ingestTransactions } from "@/lib/finance/ingest";
import { supabaseAdmin } from "@/lib/supabase";

// « Actualiser » : relit soldes + opérations (LECTURE SEULE) et enregistre ce qui est nouveau, avec les mêmes catégories que l'import CSV.
export async function POST(req: Request) {
  if (denied(req)) return NextResponse.json({ error: "Accès refusé" }, { status: 401 });
  const db = supabaseAdmin();
  const latest = await latestConnection(db);
  if (!latest.ready) return NextResponse.json({ error: "La table bank_connections n'existe pas encore (migration 0009 à appliquer)." }, { status: 503 });
  const conn = latest.connection;
  if (!conn) return NextResponse.json({ error: "Aucune banque connectée : touche « Connecter ma banque »." }, { status: 404 });
  const now = new Date();
  if ((daysLeft(conn.valid_until, now) ?? 1) <= 0) return NextResponse.json({ error: "Ton accord de lecture a expiré : reconnecte ta banque." }, { status: 409 });

  try {
    const r = await syncAccounts({ eb, accounts: conn.accounts, since: syncSince(conn.last_synced_at, now), now });
    const saved = r.items.length ? await ingestTransactions(r.items) : ({ ok: true, imported: 0, duplicates: 0, viaAi: 0 } as const);
    if (!saved.ok) return NextResponse.json({ error: saved.error }, { status: saved.status });
    await saveSync(db, conn.id, r.accounts, now);
    return NextResponse.json({ imported: saved.imported, duplicates: saved.duplicates, skipped: r.skipped, balance: totalBalance(r.accounts), syncedAt: now.toISOString() });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 }); // message brut de l'API, sans clé ni jeton
  }
}
