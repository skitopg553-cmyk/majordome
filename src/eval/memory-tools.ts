// Outils « en mémoire » pour l'évaluation : MÊMES validations que les vrais outils (taskFields, parseSlot, parseRecurrence), mais rien n'est écrit en base.
import { parseDueAt, taskFields } from "../lib/limits";
import { parseAtTime, parseRecurrence } from "../lib/recurrence";
import { oneOffRecap, parseSlot, slotRecap } from "../lib/slots";
import { hasTime, parisHM } from "../lib/planning";
import { parisDay } from "../lib/task-groups";
import type { Item } from "./score";

const hm = (iso: string) => {
  const { h, m } = parisHM(iso);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

export function memoryTools() {
  const items: Item[] = [];
  const recaps: string[] = [];
  const exec = async (name: string, args: Record<string, unknown>): Promise<string> => {
    if (name === "add_task") {
      const f = taskFields(args, { requireTitle: true });
      if (!f.ok) return JSON.stringify({ ok: false, error: f.error });
      const due = f.fields.due_at;
      const timed = !!due && hasTime(due);
      items.push({ kind: timed ? "creneau" : "pensebete", title: f.fields.title!, date: due ? parisDay(new Date(due)) : null, start: timed ? hm(due!) : null, end: f.fields.end_at ? hm(f.fields.end_at) : null });
      const recap = timed ? oneOffRecap(f.fields.title!, due!, f.fields.end_at ?? null) : `Pense-bête : ${f.fields.title}`;
      recaps.push(recap);
      return JSON.stringify({ ok: true, recap });
    }
    if (name === "add_slot") {
      const p = parseSlot(args);
      if (!p.ok) return JSON.stringify({ ok: false, error: p.error });
      if (items.some((i) => i.kind === "creneau_recurrent" && i.title.toLowerCase() === p.value.title.toLowerCase() && i.days === p.value.days && i.start === p.value.start)) return JSON.stringify({ ok: false, error: "ce créneau existe déjà" });
      items.push({ kind: "creneau_recurrent", title: p.value.title, days: p.value.days, start: p.value.start, end: p.value.end, habit: p.value.habit });
      const recap = slotRecap(p.value);
      recaps.push(recap);
      return JSON.stringify({ ok: true, recap });
    }
    if (name === "add_recurring_task") {
      const rule = parseRecurrence(args.every);
      if (!rule.ok) return JSON.stringify({ ok: false, error: rule.error });
      const at = parseAtTime(args.time);
      if (!at.ok) return JSON.stringify({ ok: false, error: at.error });
      const title = String(args.title ?? "").trim();
      if (!title) return JSON.stringify({ ok: false, error: "title requis" });
      const days = rule.value.kind === "daily" ? "1,2,3,4,5,6,7" : rule.value.kind === "weekly" ? String(rule.value.weekday) : null;
      items.push({ kind: at.value ? "creneau_recurrent" : "pensebete_recurrent", title, days, start: at.value, end: null, habit: false });
      return JSON.stringify({ ok: true });
    }
    if (typeof args.due_at === "string" && !parseDueAt(args.due_at)) return JSON.stringify({ ok: false, error: "due_at invalide" });
    return JSON.stringify({ ok: true }); // les autres outils (mémoire, Forme…) n'entrent pas dans cette évaluation
  };
  return { exec, items, recaps };
}
