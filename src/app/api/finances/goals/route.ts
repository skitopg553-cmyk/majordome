import { NextResponse } from "next/server";
import { denied } from "@/lib/access";
import { parseGoal } from "@/lib/life";
import { saveGoal } from "@/lib/life-tools";
import { isMissingTable, supabaseAdmin } from "@/lib/supabase";

// Formulaire « Nouvel objectif » : crée, ou met à jour l'objectif du même nom. Même règles que l'outil IA set_goal.
export async function POST(req: Request) {
  if (denied(req)) return NextResponse.json({ error: "Accès refusé" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const p = parseGoal(body);
  if (!p.ok) return NextResponse.json({ error: p.error }, { status: 400 });
  const r = await saveGoal(supabaseAdmin(), p.value);
  if (isMissingTable(r.error)) return NextResponse.json({ error: "Les tables Finances ne sont pas encore créées." }, { status: 503 });
  if (r.error) return NextResponse.json({ error: r.error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: r.id, created: r.created });
}
