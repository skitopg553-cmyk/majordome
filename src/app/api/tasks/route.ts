import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// Même protection que /api/chat : code d'accès dans l'en-tête.
function denied(req: Request) {
  const code = process.env.MAJORDOME_ACCESS_CODE;
  return !code || req.headers.get("x-access-code") !== code;
}

const COLS = "id,title,due_at,priority,notes,status";

export async function GET(req: Request) {
  if (denied(req)) return NextResponse.json({ error: "Accès refusé" }, { status: 401 });
  const db = supabaseAdmin();
  const [todo, done] = await Promise.all([
    db.from("tasks").select(COLS).eq("status", "todo").order("due_at", { ascending: true, nullsFirst: false }),
    db.from("tasks").select(COLS).eq("status", "done").order("done_at", { ascending: false }).limit(10),
  ]);
  const error = todo.error ?? done.error;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tasks: [...(todo.data ?? []), ...(done.data ?? [])] });
}

// Coche / décoche une tâche.
export async function PATCH(req: Request) {
  if (denied(req)) return NextResponse.json({ error: "Accès refusé" }, { status: 401 });
  const { id, done } = (await req.json().catch(() => ({}))) as { id?: number; done?: boolean };
  if (typeof id !== "number" || typeof done !== "boolean") {
    return NextResponse.json({ error: "id et done requis" }, { status: 400 });
  }
  const patch = done ? { status: "done", done_at: new Date().toISOString() } : { status: "todo", done_at: null };
  const { error } = await supabaseAdmin().from("tasks").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
