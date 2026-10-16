import { NextResponse } from "next/server";
import { denied } from "@/lib/access";
import { summarizeCosts, type CostRow } from "@/lib/costs";
import { supabaseAdmin } from "@/lib/supabase";
import { parisDay } from "@/lib/task-groups";

const PAGE = 1000; // Supabase renvoie au plus 1000 lignes par requête : on lit par pages
const MAX_PAGES = 10;

// Coût de l'IA du jour / du mois / par modèle, calculé en code à partir de ai_calls.
export async function GET(req: Request) {
  if (denied(req)) return NextResponse.json({ error: "Accès refusé" }, { status: 401 });
  const now = new Date();
  // On part d'un jour avant le 1er du mois (marge pour le décalage UTC / Paris) ; summarizeCosts garde seulement le mois de Paris.
  const [y, m] = parisDay(now).split("-").map(Number);
  const since = new Date(Date.UTC(y, m - 1, 1) - 86_400_000).toISOString();

  const db = supabaseAdmin();
  const rows: CostRow[] = [];
  let truncated = false;
  for (let page = 0; page < MAX_PAGES; page++) {
    const r = await db.from("ai_calls").select("model,cost_usd,created_at").gte("created_at", since).order("created_at").range(page * PAGE, page * PAGE + PAGE - 1);
    if (r.error) return NextResponse.json({ error: r.error.message }, { status: 500 });
    rows.push(...(r.data as CostRow[]));
    if ((r.data?.length ?? 0) < PAGE) break;
    if (page === MAX_PAGES - 1) truncated = true;
  }
  return NextResponse.json({ ...summarizeCosts(rows, now), truncated });
}
