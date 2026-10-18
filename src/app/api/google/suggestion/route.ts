import { NextResponse } from "next/server";
import { denied } from "@/lib/access";
import { supabaseAdmin } from "@/lib/supabase";

// Réponse de Ruben à un rendez-vous trouvé dans un mail : { id, action } avec action = "task" (l'ajouter à son planning majordome),
// "added" (il l'a ajouté lui-même à Google Agenda via le lien) ou "dismissed" (refusé). Aucune écriture chez Google.
export async function POST(req: Request) {
  if (denied(req)) return NextResponse.json({ error: "Accès refusé" }, { status: 401 });
  const { id, action } = (await req.json().catch(() => ({}))) as { id?: unknown; action?: unknown };
  if (typeof id !== "number" || !Number.isSafeInteger(id) || id < 1 || (action !== "task" && action !== "added" && action !== "dismissed")) return NextResponse.json({ error: "Demande invalide" }, { status: 400 });
  const db = supabaseAdmin();
  const row = await db.from("mail_suggestions").select("id,title,start_at,place,status").eq("id", id).maybeSingle();
  if (row.error || !row.data || row.data.status !== "new") return NextResponse.json({ error: "Proposition introuvable ou déjà traitée" }, { status: 404 });
  if (action === "task") {
    const title = `${row.data.title}${row.data.place ? ` — ${row.data.place}` : ""}`.slice(0, 200);
    const ins = await db.from("tasks").insert({ title, due_at: row.data.start_at, priority: 2 });
    if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 500 });
  }
  const up = await db.from("mail_suggestions").update({ status: action === "dismissed" ? "dismissed" : "added" }).eq("id", id);
  if (up.error) return NextResponse.json({ error: up.error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
