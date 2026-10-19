// Outils « en mémoire » pour l'évaluation : le calendrier passe par le VRAI code (planificateur, anti-doublon, titres, dates),
// seule l'écriture en base est remplacée par un état en mémoire. Les pense-bêtes suivent les mêmes validations que les vrais outils.
import { hasTime } from "../lib/planning";
import { hmOf } from "../lib/calendar";
import { applyMemory, parseBulk, planBulk, planCreate, type State } from "../lib/calendar-plan";
import { executeCalendarTool } from "../lib/calendar-tools";
import { parseDueAt, taskFields } from "../lib/limits";
import { parseAtTime, parseRecurrence } from "../lib/recurrence";
import { parisDay } from "../lib/task-groups";
import type { Item } from "./score";

/** Ma semaine réelle, déjà enregistrée (pour les cas « modifier », « supprimer », « envoyée deux fois »). */
export const WEEK_INPUTS = [
  { title: "Cours", days: ["lundi"], start: "09:00", end: "12:00" },
  { title: "Cours", days: ["lundi"], start: "14:00", end: "18:00" },
  { title: "Cours", days: ["mardi"], start: "09:00", end: "12:00" },
  { title: "Cours", days: ["mardi"], start: "12:30", end: "17:30" },
  { title: "Boxe anglaise", days: ["mardi"], start: "18:30", end: "20:00", habit: true },
  { title: "Cours", days: ["mercredi", "jeudi"], start: "09:00", end: "12:00" },
  { title: "Muscu", days: ["mercredi", "jeudi"], start: "12:00", end: "13:30", habit: true },
  { title: "Cours", days: ["mercredi", "jeudi"], start: "13:30", end: "17:00" },
  { title: "Cours", days: ["vendredi"], start: "09:00", end: "12:00" },
  { title: "Muscu", days: ["vendredi"], start: "12:00", end: "13:00", habit: true },
  { title: "Cours", days: ["vendredi"], start: "13:00", end: "16:00" },
  { title: "Travail O'Tacos", days: ["vendredi", "dimanche"], start: "18:30", end: "23:00" },
];

export function seedState(seed: "week" | "week+reminders" | undefined, now: Date): State {
  let s: State = { tasks: [], rules: [], exceptions: [] };
  if (!seed) return s;
  for (const i of WEEK_INPUTS) {
    const p = planCreate(s, i, now);
    if (p.ok) s = applyMemory(s, p.ops);
  }
  if (seed === "week+reminders") {
    s = applyMemory(s, [
      { op: "insert", table: "tasks", values: { title: "Sortir les poubelles", due_at: null, end_at: null } },
      { op: "insert", table: "tasks", values: { title: "Rendez-vous dentiste", due_at: "2026-10-22T13:00:00.000Z", end_at: "2026-10-22T14:00:00.000Z" } },
    ]);
  }
  return s;
}

/** Ce que contient l'état, dans le format comparé par score.ts. */
export function itemsOf(s: State): Item[] {
  const out: Item[] = [];
  for (const r of s.rules) {
    if (r.at_time) out.push({ kind: "creneau_recurrent", title: r.title, days: r.days ?? (r.kind === "daily" ? "1,2,3,4,5,6,7" : String(r.weekday)), start: r.at_time, end: r.end_time ?? null, habit: !!r.habit });
    else out.push({ kind: "pensebete_recurrent", title: r.title, days: r.kind === "daily" ? "1,2,3,4,5,6,7" : r.kind === "weekly" ? String(r.weekday) : null });
  }
  for (const t of s.tasks) {
    if (t.status !== "todo") continue;
    const timed = !!t.due_at && hasTime(t.due_at);
    out.push({ kind: timed ? "creneau" : "pensebete", title: t.title, date: t.due_at ? parisDay(new Date(t.due_at)) : null, start: timed ? hmOf(t.due_at!) : null, end: timed && t.end_at ? hmOf(t.end_at) : null });
  }
  for (const e of s.exceptions) out.push({ kind: "exception", title: s.rules.find((r) => r.id === e.rule_id)?.title ?? "?", date: e.day, start: e.new_start, end: e.new_end, action: e.action });
  return out;
}

export function memoryTools(now: Date, initial?: State) {
  let state: State = initial ?? { tasks: [], rules: [], exceptions: [] };
  const recaps: string[] = [];
  let bulkDone = "";
  const backend = {
    load: async () => state,
    apply: async (ops: Parameters<typeof applyMemory>[1]) => {
      state = applyMemory(state, ops);
      return { ok: true, undo: null };
    },
  };
  const exec = async (name: string, args: Record<string, unknown>): Promise<string> => {
    const cal = await executeCalendarTool(name, args, backend, now);
    if (cal) {
      const r = JSON.parse(cal) as { ok?: boolean; recap?: unknown; card?: { bulk?: Record<string, unknown> } };
      if (r.recap) recaps.push(...(Array.isArray(r.recap) ? r.recap : [r.recap]));
      if (r.card?.bulk) {
        // Ruben touche « Supprimer » sur la carte : même chemin que /api/calendar (action bulk).
        const b = parseBulk(r.card.bulk, now);
        if (b.ok) {
          const p = planBulk(state, b.value);
          state = applyMemory(state, p.ops);
          bulkDone = p.done;
        }
      }
      return cal;
    }
    if (name === "add_task") {
      const f = taskFields(args, { requireTitle: true });
      if (!f.ok) return JSON.stringify({ ok: false, error: f.error });
      if (f.fields.due_at && hasTime(f.fields.due_at)) return JSON.stringify({ ok: false, error: "un pense-bête n'a pas d'heure : avec une heure, c'est un événement → add_event (avec une heure de fin)." });
      state = applyMemory(state, [{ op: "insert", table: "tasks", values: { title: f.fields.title!, due_at: f.fields.due_at ?? null, end_at: null } }]);
      recaps.push(`Pense-bête : ${f.fields.title}`);
      return JSON.stringify({ ok: true, recap: `Pense-bête : ${f.fields.title}` });
    }
    if (name === "add_recurring_task") {
      const rule = parseRecurrence(args.every);
      if (!rule.ok) return JSON.stringify(rule);
      const at = parseAtTime(args.time);
      if (!at.ok) return JSON.stringify(at);
      if (at.value) return JSON.stringify({ ok: false, error: "avec une heure, c'est un événement : utilise add_event (days + start + end)." });
      const title = String(args.title ?? "").trim();
      if (!title) return JSON.stringify({ ok: false, error: "title requis" });
      state = applyMemory(state, [{ op: "insert", table: "recurring_tasks", values: { title, kind: rule.value.kind, weekday: rule.value.weekday, month_day: rule.value.month_day, at_time: null } }]);
      return JSON.stringify({ ok: true, recap: `${title} (revient)` });
    }
    if (typeof args.due_at === "string" && !parseDueAt(args.due_at)) return JSON.stringify({ ok: false, error: "due_at invalide" });
    return JSON.stringify({ ok: true }); // les autres outils (mémoire, Forme…) n'entrent pas dans cette évaluation
  };
  return { exec, items: () => itemsOf(state), state: () => state, recaps, bulkDone: () => bulkDone };
}
