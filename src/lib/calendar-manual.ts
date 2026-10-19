// Fiches de l'écran : elles désignent UN élément précis (son identifiant reste interne, jamais affiché). On le traduit en « titre + jour »
// pour réutiliser exactement les mêmes plans que l'IA (calendar-plan.ts).
import type { FindInput, State } from "./calendar-plan";
import { parisDay } from "./task-groups";

type Res<T> = { ok: true; value: T } | { ok: false; error: string };

export function manualTarget(state: State, raw: unknown): Res<{ kind: "task" | "rule"; id: number; find: FindInput }> {
  const t = raw as { kind?: unknown; id?: unknown; day?: unknown } | null;
  if (!t || (t.kind !== "task" && t.kind !== "rule") || typeof t.id !== "number") return { ok: false, error: "élément invalide" };
  if (t.kind === "task") {
    const task = state.tasks.find((x) => x.id === t.id);
    if (!task || !task.due_at) return { ok: false, error: "événement introuvable" };
    return { ok: true, value: { kind: "task", id: task.id, find: { title: task.title, day: parisDay(new Date(task.due_at)) } } };
  }
  const rule = state.rules.find((r) => r.id === t.id);
  if (!rule) return { ok: false, error: "événement introuvable" };
  const day = typeof t.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(t.day) ? t.day : undefined;
  return { ok: true, value: { kind: "rule", id: rule.id, find: { title: rule.title, day } } };
}
