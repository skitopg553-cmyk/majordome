import { NextResponse } from "next/server";
import { checkCron, isRecurringHour } from "@/lib/cron-auth";
import { materializeToday } from "@/lib/recurring-store";
import { supabaseAdmin } from "@/lib/supabase";

// Crée les tâches récurrentes du jour (« tous les lundis »…) SANS que Ruben ouvre l'app. Appelée par Supabase pg_cron (voir migration 0013),
// protégée par x-cron-secret. Idempotente : une règle ne crée qu'une tâche par jour (last_generated), donc un double appel ne fait rien de plus.
// Sans { "force": true } dans le corps, ne fait quelque chose qu'à 4 h (Paris) : le job tourne à 2 h et 3 h UTC et une seule de ces heures tombe à 4 h Paris.
export async function POST(req: Request) {
  const auth = checkCron(req);
  if (auth === "off") return NextResponse.json({ error: "Tâches planifiées non configurées" }, { status: 404 });
  if (auth === "denied") return NextResponse.json({ error: "Accès refusé" }, { status: 401 });
  const force = ((await req.json().catch(() => ({}))) as { force?: boolean }).force === true;
  const now = new Date();
  if (!force && !isRecurringHour(now)) return NextResponse.json({ created: 0, skipped: "pas 4 h à Paris" });
  const created = await materializeToday(supabaseAdmin(), now);
  return NextResponse.json({ created });
}
