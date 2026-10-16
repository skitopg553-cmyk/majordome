import { NextResponse } from "next/server";
import { denied } from "@/lib/access";
import { supabaseAdmin } from "@/lib/supabase";
import { parseDeleteRequest } from "@/lib/undo";

// Suppression d'une entrée depuis son écran (tâche, opération, séance, nuit, pas, objectif, souvenir, budget).
// DÉFINITIF : l'écran demande toujours une confirmation avant d'appeler cette route. Tables autorisées : voir src/lib/undo.ts.
export async function DELETE(req: Request) {
  if (denied(req)) return NextResponse.json({ error: "Accès refusé" }, { status: 401 });
  const target = parseDeleteRequest(await req.json().catch(() => null));
  if (!target) return NextResponse.json({ error: "Suppression invalide" }, { status: 400 });
  const q = db().from(target.table).delete();
  const { error } = await ("id" in target ? q.eq("id", target.id) : q.eq("date", target.date));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

const db = () => supabaseAdmin();
