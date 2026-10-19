// Lecture de l'état du calendrier dans la base, et écriture des opérations décidées par le planificateur (calendar-plan.ts), avec de quoi les ANNULER.
import type { Op, State } from "./calendar-plan";
import { restorable } from "./life-tools";
import { listRules } from "./recurring-store";
import { isMissingTable, supabaseAdmin } from "./supabase";
import type { Undo, UndoStep } from "./undo";

type Db = ReturnType<typeof supabaseAdmin>;

/** Tout ce qu'il faut pour décider : tâches (à faire, et les événements des 60 derniers jours), règles, exceptions. Null si la base n'est pas prête. */
export async function loadState(db: Db): Promise<State | null> {
  const since = new Date(Date.now() - 60 * 86_400_000).toISOString();
  const [tasks, rules, exc] = await Promise.all([
    db.from("tasks").select("*").or(`status.eq.todo,due_at.gte.${since}`),
    listRules(db),
    db.from("recurring_exceptions").select("id,rule_id,day,action,new_day,new_start,new_end"),
  ]);
  if (tasks.error || !rules) return null;
  return { tasks: (tasks.data ?? []) as State["tasks"], rules, exceptions: exc.error ? [] : ((exc.data ?? []) as State["exceptions"]) };
}

/**
 * Écrit les opérations dans l'ordre. S'arrête à la première erreur (et le dit) : on ne raconte jamais une action qui n'a pas eu lieu.
 * Renvoie l'annulation de ce qui a VRAIMENT été écrit (supprimer ce qui a été créé, remettre ce qui a été modifié, recréer ce qui a été supprimé).
 */
export async function applyOps(db: Db, ops: Op[], label: string): Promise<{ ok: boolean; error?: string; written: number; undo: Undo | null }> {
  const steps: UndoStep[] = [];
  let written = 0;
  for (const o of ops) {
    let error: { code?: string; message: string } | null = null;
    if (o.op === "insert") {
      const r = await db.from(o.table).insert(o.values as never).select("id").single();
      error = r.error;
      if (!error) steps.push({ op: "delete", table: o.table, id: Number((r.data as { id: number }).id) });
    } else if (o.op === "update") {
      error = (await db.from(o.table).update(o.values as never).eq("id", o.id)).error;
      if (!error) steps.push({ op: "restore", table: o.table, id: o.id, values: restorable(o.table, o.before) });
    } else {
      error = (await db.from(o.table).delete().eq("id", o.id)).error;
      if (!error) steps.push({ op: "insert", table: o.table, values: restorable(o.table, o.before) });
    }
    if (error) {
      const msg = isMissingTable(error) ? "la base n'est pas prête (migration 0014 manquante)" : error.message;
      return { ok: false, error: `${written} sur ${ops.length} écrit(s), puis erreur : ${msg}`, written, undo: steps.length ? { label, steps } : null };
    }
    written++;
  }
  return { ok: true, written, undo: steps.length ? { label, steps } : null };
}
