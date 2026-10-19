import { NextResponse } from "next/server";
import { denied } from "@/lib/access";
import { parseBulk, planBulk, planCreate, planDelete, planUpdate, type Op, type Plan, type State } from "@/lib/calendar-plan";
import { applyOps, loadState } from "@/lib/calendar-store";
import { manualTarget } from "@/lib/calendar-manual";
import { supabaseAdmin } from "@/lib/supabase";

// Le calendrier modifié À LA MAIN (fiches de l'écran) et la suppression en masse confirmée depuis le chat.
// Mêmes règles que l'IA (calendar-plan.ts) : titres propres, fin obligatoire, anti-doublon. Chaque écriture renvoie de quoi l'annuler.
//   { action: "create", title, day, start, end, days? }                   → ponctuel (day) ou récurrent (days)
//   { action: "update", target, scope, title?, day?, start?, end?, days? } → target = { kind: "task", id } ou { kind: "rule", id, day }
//   { action: "delete", target, scope }
//   { action: "bulk", scope, from?, to?, include_reminders? }             → après la carte de confirmation du chat
export async function POST(req: Request) {
  if (denied(req)) return NextResponse.json({ error: "Accès refusé" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const db = supabaseAdmin();
  const state = await loadState(db);
  if (!state) return NextResponse.json({ error: "Calendrier indisponible pour le moment" }, { status: 503 });
  const now = new Date();

  let plan: Plan;
  let label = "Calendrier";
  if (b.action === "bulk") {
    const p = parseBulk(b, now);
    if (!p.ok) return NextResponse.json({ error: p.error }, { status: 400 });
    const bulk = planBulk(state, p.value);
    plan = { ok: true, ops: bulk.ops, done: [bulk.done] };
    label = "Suppression en masse";
  } else if (b.action === "create") {
    plan = planCreate(state, b, now);
    label = "Ajout";
  } else if (b.action === "update" || b.action === "delete") {
    const t = manualTarget(state, b.target);
    if (!t.ok) return NextResponse.json({ error: t.error }, { status: 404 });
    const repeat = Array.isArray(b.days) && b.days.length > 0;
    if (b.action === "update" && t.value.kind === "task" && repeat) {
      // Un événement ponctuel qu'on fait revenir chaque semaine : il devient une règle (créée), l'ancien ponctuel est retiré.
      const del = planDelete(scoped(state, t.value), t.value.find, now);
      const add = planCreate({ ...state, tasks: state.tasks.filter((x) => x.id !== t.value.id) }, b, now);
      plan = !del.ok ? del : !add.ok ? add : { ok: true, ops: [...del.ops, ...add.ops], done: add.done };
    } else plan = b.action === "update" ? planUpdate(scoped(state, t.value), { ...t.value.find, scope: b.scope, new_title: b.title, new_day: b.day, new_start: b.start, new_end: b.end, new_days: b.days }, now) : planDelete(scoped(state, t.value), { ...t.value.find, scope: b.scope }, now);
    label = b.action === "update" ? "Modification" : "Suppression";
  } else return NextResponse.json({ error: "action inconnue" }, { status: 400 });

  if (!plan.ok) return NextResponse.json({ error: plan.error }, { status: 400 });
  if (!plan.ops.length) return NextResponse.json({ ok: true, done: plan.done.join(" ; "), undo: null });
  const w = await applyOps(db, plan.ops as Op[], label);
  if (!w.ok) return NextResponse.json({ error: w.error, undo: w.undo }, { status: 500 });
  return NextResponse.json({ ok: true, done: plan.done.join(" ; "), undo: w.undo });
}

/** Une fiche désigne UN élément précis : on restreint l'état à lui, pour que la recherche par titre ne puisse pas en trouver un autre. */
function scoped(state: State, t: { kind: "task" | "rule"; id: number }): State {
  return t.kind === "task" ? { ...state, tasks: state.tasks.filter((x) => x.id === t.id), rules: [] } : { ...state, tasks: [], rules: state.rules.filter((r) => r.id === t.id) };
}
