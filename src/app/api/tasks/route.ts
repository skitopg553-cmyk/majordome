import { NextResponse } from "next/server";
import { denied } from "@/lib/access";
import { supabaseAdmin } from "@/lib/supabase";
import { parseDueAt, taskFields } from "@/lib/limits";
import { isSimilar } from "@/lib/tools";

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

// Ajout rapide depuis l'app, sans passer par l'IA (gratuit et instantané).
export async function POST(req: Request) {
  if (denied(req)) return NextResponse.json({ error: "Accès refusé" }, { status: 401 });
  // Titre borné, échéance stricte (avec fuseau), priorité 1-3 : mêmes règles que l'outil de l'IA (src/lib/limits.ts).
  const f = taskFields((await req.json().catch(() => ({}))) as Record<string, unknown>, { requireTitle: true });
  if (!f.ok) return NextResponse.json({ error: f.error }, { status: 400 });
  const clean = f.fields.title!;
  const due_at = f.fields.due_at;
  const priority = f.fields.priority;

  const db = supabaseAdmin();
  const open = await db.from("tasks").select("id,title").eq("status", "todo");
  if (open.error) return NextResponse.json({ error: open.error.message }, { status: 500 });
  const dup = (open.data ?? []).find((t) => isSimilar(t.title, clean));
  if (dup) return NextResponse.json({ error: `Déjà dans la liste : « ${dup.title} »` }, { status: 409 });

  const { data, error } = await db
    .from("tasks")
    .insert({ title: clean, due_at: due_at || null, priority: priority ?? 2 })
    .select(COLS)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ task: data });
}

// Coche / décoche une tâche ({ id, done }) ou la reporte ({ id, due_at }).
export async function PATCH(req: Request) {
  if (denied(req)) return NextResponse.json({ error: "Accès refusé" }, { status: 401 });
  const { id, done, due_at } = (await req.json().catch(() => ({}))) as { id?: number; done?: boolean; due_at?: string };
  if (typeof id !== "number" || (typeof done !== "boolean" && typeof due_at !== "string")) {
    return NextResponse.json({ error: "id et done (ou due_at) requis" }, { status: 400 });
  }
  if (typeof due_at === "string" && !parseDueAt(due_at)) return NextResponse.json({ error: "Date invalide : date ISO 8601 avec fuseau attendue" }, { status: 400 });
  const patch =
    typeof due_at === "string"
      ? { due_at }
      : done
        ? { status: "done", done_at: new Date().toISOString() }
        : { status: "todo", done_at: null };
  const { error } = await supabaseAdmin().from("tasks").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
