import { NextResponse } from "next/server";
import { denied } from "@/lib/access";
import { supabaseAdmin } from "@/lib/supabase";
import { taskFields, taskPatch } from "@/lib/limits";
import { materializeToday } from "@/lib/recurring-store";
import { isSimilar } from "@/lib/tools";

const COLS = "*"; // « * » : la colonne end_at (migration 0014) apparaît toute seule dès qu'elle existe, et l'app marche sans

export async function GET(req: Request) {
  if (denied(req)) return NextResponse.json({ error: "Accès refusé" }, { status: 401 });
  const db = supabaseAdmin();
  await materializeToday(db).catch((e) => console.error("récurrentes :", e)); // les tâches « tous les lundis »… du jour (sans effet si la table n'existe pas)
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

// Coche / décoche une tâche ({ id, done }) ou la modifie ({ id, title?, due_at?, priority?, notes? } : voir taskPatch).
export async function PATCH(req: Request) {
  if (denied(req)) return NextResponse.json({ error: "Accès refusé" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (typeof body.id !== "number") return NextResponse.json({ error: "id requis" }, { status: 400 });
  const p = taskPatch(body);
  if (!p.ok) return NextResponse.json({ error: p.error }, { status: 400 });
  const { error } = await supabaseAdmin().from("tasks").update(p.patch).eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
