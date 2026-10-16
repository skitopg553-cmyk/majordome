import { NextResponse } from "next/server";
import { denied } from "@/lib/access";
import { supabaseAdmin } from "@/lib/supabase";
import { parseUndoSteps } from "@/lib/undo";

// Bouton « Annuler » sous une réponse de Majordome. Seules les tables et colonnes autorisées (src/lib/undo.ts) peuvent être touchées ;
// un lot mal formé est refusé en entier. Les étapes sont défaites dans l'ordre inverse de leur écriture.
export async function POST(req: Request) {
  if (denied(req)) return NextResponse.json({ error: "Accès refusé" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { steps?: unknown };
  const steps = parseUndoSteps(body.steps);
  if (!steps) return NextResponse.json({ error: "Demande d'annulation invalide" }, { status: 400 });

  const db = supabaseAdmin();
  let undone = 0;
  for (const step of [...steps].reverse()) {
    const r =
      step.op === "delete"
        ? await db.from(step.table).delete().eq("id", step.id)
        : step.op === "restore"
          ? await db.from(step.table).update(step.values as never).eq("id", step.id)
          : await db.from(step.table).insert(step.values as never);
    if (r.error) return NextResponse.json({ error: r.error.message, undone }, { status: 500 });
    undone++;
  }
  return NextResponse.json({ ok: true, undone });
}
