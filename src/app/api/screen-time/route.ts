import { NextResponse } from "next/server";
import { denied } from "@/lib/access";
import { parseScreenTime } from "@/lib/screen-time";
import { isMissingTable, supabaseAdmin } from "@/lib/supabase";

// Enregistre le temps d'écran d'un jour : { minutes } ou { hours[, minutes] }, et facultativement { date: "AAAA-MM-JJ" } (absent = aujourd'hui).
// Utilisée par le bouton de l'écran Forme (après confirmation) ET par Tasker (voir docs/temps-ecran.md).
// Protégée comme toutes les routes : en-tête x-access-code. Un jour = une ligne : renvoyer la même date remplace la valeur.
export async function POST(req: Request) {
  if (denied(req)) return NextResponse.json({ error: "Accès refusé" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const p = parseScreenTime(body, new Date());
  if (!p.ok) return NextResponse.json({ error: p.error }, { status: 400 });
  const { error } = await supabaseAdmin().from("screen_time_logs").upsert(p.value, { onConflict: "date" });
  if (isMissingTable(error)) return NextResponse.json({ error: "La table du temps d'écran n'existe pas encore (migration 0011 à appliquer)." }, { status: 503 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, ...p.value });
}
