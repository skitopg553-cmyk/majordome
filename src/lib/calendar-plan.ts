// Planificateur du calendrier : à partir de l'état actuel (en mémoire), décide QUOI écrire (une liste d'opérations) et écrit la phrase de confirmation.
// Pur et testé. Les mêmes plans servent à l'écran (fiches), à l'IA (outils) et à l'évaluation (base en mémoire) : une seule logique, un seul anti-doublon.
import { cleanTitle, DEFAULT_MINUTES, dayText, eventsOn, fromMin, hmOf, isoAt, normTitle, overlaps, rangeText, refuseTitle, resolveDay, toMin } from "./calendar";
import { hasTime } from "./planning";
import type { StoredRule } from "./recurrence";
import { daysLabel, parseDays, parseHour, type SlotException } from "./slots";
import { addDays, parisDay } from "./task-groups";

type Res<T> = { ok: true; value: T } | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

export type Row = Record<string, string | number | null>;
export type TaskRow = { id: number; title: string; due_at: string | null; end_at?: string | null; status: "todo" | "done"; priority?: number; notes?: string | null };
export type ExcRow = SlotException & { id: number };
export type State = { tasks: TaskRow[]; rules: StoredRule[]; exceptions: ExcRow[] };
export type Table = "tasks" | "recurring_tasks" | "recurring_exceptions";
export type Op = { op: "insert"; table: Table; values: Row } | { op: "update"; table: Table; id: number; values: Row; before: Row } | { op: "delete"; table: Table; id: number; before: Row };
export type Plan = { ok: true; ops: Op[]; done: string[] } | { ok: false; error: string };

const plural = (n: number, w: string) => `${n} ${w}${n > 1 ? "s" : ""}`;
const isEventRule = (r: StoredRule) => !!r.at_time;
const ruleEnd = (r: StoredRule) => r.end_time ?? fromMin(Math.min(toMin(r.at_time!) + DEFAULT_MINUTES, 1439));
const ruleDays = (r: StoredRule) => r.days ?? (r.kind === "daily" ? "1,2,3,4,5,6,7" : r.weekday ? String(r.weekday) : "");
const taskRow = (t: TaskRow): Row => ({ title: t.title, due_at: t.due_at, end_at: t.end_at ?? null, priority: t.priority ?? 2, notes: t.notes ?? null, status: t.status });
const ruleRow = (r: StoredRule): Row => ({ title: r.title, kind: r.kind, weekday: r.weekday, month_day: r.month_day, at_time: r.at_time, last_generated: r.last_generated, days: r.days ?? null, end_time: r.end_time ?? null, habit: r.habit ? 1 : 0 });
const excRow = (e: ExcRow): Row => ({ rule_id: e.rule_id, day: e.day, action: e.action, new_day: e.new_day, new_start: e.new_start, new_end: e.new_end });
const recurringText = (r: { title: string; days: string; start: string; end: string; habit?: boolean }) => `${r.title} ${daysLabel(r.days)} ${rangeText(r.start, r.end)}${r.habit ? " (habitude à confirmer)" : ""}`;

// ---------- Créer ----------

export type EventInput = { title?: unknown; day?: unknown; days?: unknown; start?: unknown; end?: unknown; assume_one_hour?: unknown; habit?: unknown };

/** Heures d'un événement : début obligatoire ; fin obligatoire, sauf « 1 h par défaut » demandé explicitement. */
function hours(a: EventInput): Res<{ start: string; end: string; assumed: boolean }> {
  const s = parseHour(a.start);
  if (!s.ok) return fail(`start : ${s.error}`);
  if (a.end === undefined || a.end === null || a.end === "") {
    if (a.assume_one_hour !== true) return fail("FIN MANQUANTE : n'invente rien. Pose UNE question à Ruben : « Jusqu'à quelle heure ? ». S'il ne sait pas ou ne répond pas, rappelle l'outil avec assume_one_hour: true (1 h par défaut, et dis-le).");
    return { ok: true, value: { start: s.value, end: fromMin(Math.min(toMin(s.value) + DEFAULT_MINUTES, 1439)), assumed: true } };
  }
  const e = parseHour(a.end);
  if (!e.ok) return fail(`end : ${e.error}`);
  if (toMin(e.value) <= toMin(s.value)) return fail("la fin doit être après le début, le même jour (ex. 09:00 → 12:00)");
  return { ok: true, value: { start: s.value, end: e.value, assumed: false } };
}

const hasDays = (v: unknown) => (Array.isArray(v) ? v.length > 0 : typeof v === "string" && v.trim() !== "");

/**
 * Créer un événement. Récurrent si `days` est donné, sinon ponctuel le jour `day`. ANTI-DOUBLON : même titre (normalisé) + un jour en commun
 * + horaires qui se chevauchent → on MET À JOUR l'existant au lieu d'en créer un second.
 */
export function planCreate(state: State, a: EventInput, now: Date): Plan {
  const raw = typeof a.title === "string" ? a.title.trim() : "";
  if (!raw) return fail("title requis (texte court, ex. « Cours »)");
  const refused = refuseTitle(raw);
  if (refused) return fail(refused);
  const title = cleanTitle(raw);
  const h = hours(a);
  if (!h.ok) return h;
  const { start, end, assumed } = h.value;
  const tail = assumed ? " (1 h par défaut : dis-moi l'heure de fin pour corriger)" : "";
  const n = normTitle(title);
  const habit = a.habit === true;

  if (hasDays(a.days)) {
    const d = parseDays(a.days);
    if (!d.ok) return d;
    const set = d.value.split(",");
    const dup = state.rules.find((r) => isEventRule(r) && normTitle(r.title) === n && ruleDays(r).split(",").some((x) => set.includes(x)) && overlaps({ start: r.at_time!, end: ruleEnd(r) }, { start, end }));
    if (dup) {
      const days = [...new Set([...ruleDays(dup).split(","), ...set])].map(Number).sort((x, y) => x - y).join(",");
      const values: Row = { title, days, weekday: Number(days.split(",")[0]), kind: "weekly", at_time: start, end_time: end, habit: habit || dup.habit ? 1 : 0 };
      return { ok: true, ops: [{ op: "update", table: "recurring_tasks", id: dup.id, values, before: ruleRow(dup) }], done: [`Mis à jour (déjà présent) : ${recurringText({ title, days, start, end, habit: !!values.habit })}${tail}`] };
    }
    const values: Row = { title, kind: "weekly", weekday: Number(set[0]), days: d.value, at_time: start, end_time: end, habit: habit ? 1 : 0 };
    return { ok: true, ops: [{ op: "insert", table: "recurring_tasks", values }], done: [`${recurringText({ title, days: d.value, start, end, habit })}${tail}`] };
  }

  const day = resolveDay(a.day, now);
  if (!day.ok) return day;
  const same = eventsOn(day.value, state.tasks, state.rules, state.exceptions).find((e) => normTitle(e.title) === n && overlaps(e, { start, end }));
  if (same?.source === "rule") return { ok: true, ops: [], done: [`Déjà prévu : ${same.title} ${dayText(day.value)} ${rangeText(same.start, same.end)} (revient chaque semaine)`] };
  const values: Row = { title, due_at: isoAt(day.value, start), end_at: isoAt(day.value, end) };
  const text = `${title} ${dayText(day.value)} ${rangeText(start, end)}, une seule fois${tail}`;
  if (same) {
    const t = state.tasks.find((x) => x.id === same.id)!;
    return { ok: true, ops: [{ op: "update", table: "tasks", id: t.id, values, before: taskRow(t) }], done: [`Mis à jour (déjà présent) : ${text}`] };
  }
  return { ok: true, ops: [{ op: "insert", table: "tasks", values: { ...values, priority: 2 } }], done: [text] };
}

// ---------- Retrouver un événement par son titre et son jour (jamais par un identifiant) ----------

export type Target = { kind: "task"; task: TaskRow } | { kind: "rule"; rule: StoredRule; day: string | null } | { kind: "reminder"; task: TaskRow };
export type FindInput = { title?: unknown; day?: unknown; at?: unknown };

const inMoment = (start: string, at: string) => {
  if (/^mat/.test(at)) return toMin(start) < 12 * 60;
  if (/^(apr|aprem|midi)/.test(at)) return toMin(start) >= 12 * 60 && toMin(start) < 18 * 60;
  if (/^soi/.test(at)) return toMin(start) >= 18 * 60;
  return null;
};
function atFilter(at: unknown): ((s: string, e: string) => boolean) | null {
  if (typeof at !== "string" || !at.trim()) return null;
  const t = at.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  if (inMoment("00:00", t) !== null) return (s) => inMoment(s, t)!;
  const h = parseHour(at);
  return h.ok ? (s, e) => toMin(s) <= toMin(h.value) && toMin(h.value) < toMin(e) : null;
}
const titleMatch = (candidate: string, wanted: string) => {
  const c = normTitle(candidate);
  return c === wanted || (wanted.length >= 3 && (c.includes(wanted) || wanted.includes(c)));
};

/** Les événements (et, à défaut, pense-bêtes) qui correspondent. Avec un jour : seulement ce jour-là. `at` : heure (« 14:00 ») ou moment (« après-midi »). */
export function findTargets(state: State, f: FindInput, now: Date): Res<Target[]> {
  const wanted = typeof f.title === "string" ? normTitle(f.title) : "";
  if (!wanted) return fail("title requis : le titre de l'événement tel que Ruben le dit (ex. « boxe »)");
  const at = atFilter(f.at);
  let day: string | null = null;
  if (f.day !== undefined && f.day !== null && f.day !== "") {
    const d = resolveDay(f.day, now);
    if (!d.ok) return d;
    day = d.value;
  }
  const out: Target[] = [];
  if (day) {
    for (const e of eventsOn(day, state.tasks, state.rules, state.exceptions)) {
      if (!titleMatch(e.title, wanted) || (at && !at(e.start, e.end))) continue;
      if (e.source === "task") out.push({ kind: "task", task: state.tasks.find((t) => t.id === e.id)! });
      else out.push({ kind: "rule", rule: state.rules.find((r) => r.id === e.id)!, day: e.day });
    }
  } else {
    for (const r of state.rules) if (isEventRule(r) && titleMatch(r.title, wanted) && (!at || at(r.at_time!, ruleEnd(r)))) out.push({ kind: "rule", rule: r, day: null });
    for (const t of state.tasks) if (t.status === "todo" && t.due_at && hasTime(t.due_at) && parisDay(new Date(t.due_at)) >= parisDay(now) && titleMatch(t.title, wanted) && (!at || at(hmOf(t.due_at), t.end_at ? hmOf(t.end_at) : "23:59"))) out.push({ kind: "task", task: t });
  }
  if (!out.length) for (const t of state.tasks) if (t.status === "todo" && !(t.due_at && hasTime(t.due_at)) && titleMatch(t.title, wanted)) out.push({ kind: "reminder", task: t });
  return { ok: true, value: out };
}

const describe = (t: Target) =>
  t.kind === "rule"
    ? `« ${t.rule.title} » ${t.day ? dayText(t.day) : daysLabel(ruleDays(t.rule))} ${rangeText(t.rule.at_time!, ruleEnd(t.rule))}`
    : t.kind === "task"
      ? `« ${t.task.title} » ${dayText(parisDay(new Date(t.task.due_at!)))} ${hmOf(t.task.due_at!)}`
      : `pense-bête « ${t.task.title} »`;

function one(state: State, f: FindInput, now: Date): Res<Target> {
  const r = findTargets(state, f, now);
  if (!r.ok) return r;
  if (!r.value.length) {
    const known = [...new Set(state.rules.filter(isEventRule).map((x) => x.title))].slice(0, 12).join(", ");
    return fail(`aucun événement « ${String(f.title)} »${f.day ? ` ce jour-là` : ""}. Dis-le à Ruben, n'invente rien.${known ? ` Événements qui reviennent : ${known}.` : ""}`);
  }
  if (r.value.length > 1) return fail(`plusieurs correspondent : ${r.value.slice(0, 6).map(describe).join(" ; ")}. Précise avec day et/ou at (heure de début, ou « matin », « après-midi », « soir »), ou pose UNE question à Ruben.`);
  return { ok: true, value: r.value[0] };
}

// ---------- Modifier ----------

export type UpdateInput = FindInput & { scope?: unknown; new_title?: unknown; new_day?: unknown; new_start?: unknown; new_end?: unknown; new_days?: unknown; habit?: unknown };

/** Nouvelles heures : la durée est gardée quand seul le début change. */
function newHours(a: UpdateInput, start: string, end: string): Res<{ start: string; end: string }> {
  let s = start;
  let e = end;
  if (a.new_start !== undefined && a.new_start !== null && a.new_start !== "") {
    const p = parseHour(a.new_start);
    if (!p.ok) return fail(`new_start : ${p.error}`);
    s = p.value;
    e = fromMin(Math.min(toMin(s) + (toMin(end) - toMin(start)), 1439));
  }
  if (a.new_end !== undefined && a.new_end !== null && a.new_end !== "") {
    const p = parseHour(a.new_end);
    if (!p.ok) return fail(`new_end : ${p.error}`);
    e = p.value;
  }
  if (toMin(e) <= toMin(s)) return fail("la fin doit être après le début, le même jour");
  return { ok: true, value: { start: s, end: e } };
}

export function planUpdate(state: State, a: UpdateInput, now: Date): Plan {
  const t = one(state, a, now);
  if (!t.ok) return t;
  const target = t.value;
  const newTitle = typeof a.new_title === "string" && a.new_title.trim() ? cleanTitle(a.new_title) : null;
  if (newTitle && refuseTitle(newTitle)) return fail(refuseTitle(newTitle)!);

  if (target.kind === "reminder") return fail(`« ${target.task.title} » est un pense-bête (sans heure) : utilise update_task.`);

  if (target.kind === "task") {
    const task = target.task;
    const curDay = parisDay(new Date(task.due_at!));
    const curStart = hmOf(task.due_at!);
    const curEnd = task.end_at ? hmOf(task.end_at) : fromMin(Math.min(toMin(curStart) + DEFAULT_MINUTES, 1439));
    const h = newHours(a, curStart, curEnd);
    if (!h.ok) return h;
    let day = curDay;
    if (a.new_day) {
      const d = resolveDay(a.new_day, now);
      if (!d.ok) return d;
      day = d.value;
    }
    const title = newTitle ?? task.title;
    return { ok: true, ops: [{ op: "update", table: "tasks", id: task.id, values: { title, due_at: isoAt(day, h.value.start), end_at: isoAt(day, h.value.end) }, before: taskRow(task) }], done: [`Modifié : ${title} ${dayText(day)} ${rangeText(h.value.start, h.value.end)}`] };
  }

  const rule = target.rule;
  const scope = a.scope === "once" || a.scope === "series" ? a.scope : target.day ? "once" : "series";
  const h = newHours(a, rule.at_time!, ruleEnd(rule));
  if (!h.ok) return h;
  const title = newTitle ?? rule.title;

  if (scope === "series") {
    let days = ruleDays(rule);
    if (hasDays(a.new_days)) {
      const d = parseDays(a.new_days);
      if (!d.ok) return d;
      days = d.value;
    }
    const values: Row = { title, at_time: h.value.start, end_time: h.value.end, days, kind: "weekly", weekday: Number(days.split(",")[0]), habit: typeof a.habit === "boolean" ? (a.habit ? 1 : 0) : rule.habit ? 1 : 0 };
    return { ok: true, ops: [{ op: "update", table: "recurring_tasks", id: rule.id, values, before: ruleRow(rule) }], done: [`Modifié (toutes les semaines) : ${recurringText({ title, days, start: h.value.start, end: h.value.end, habit: !!values.habit })}`] };
  }

  if (!target.day) return fail("pour « cette fois seulement », donne le jour (day) de l'occurrence à changer");
  let newDay = target.day;
  if (a.new_day) {
    const d = resolveDay(a.new_day, now);
    if (!d.ok) return d;
    newDay = d.value;
  }
  const ops: Op[] = [];
  const existing = state.exceptions.find((e) => e.rule_id === rule.id && e.day === target.day);
  if (newTitle && newTitle !== rule.title) {
    // Un autre titre pour une seule fois : l'occurrence est retirée et remplacée par un événement ponctuel.
    ops.push(existing ? { op: "update", table: "recurring_exceptions", id: existing.id, values: { action: "skip", new_day: null, new_start: null, new_end: null }, before: excRow(existing) } : { op: "insert", table: "recurring_exceptions", values: { rule_id: rule.id, day: target.day, action: "skip", new_day: null, new_start: null, new_end: null } });
    ops.push({ op: "insert", table: "tasks", values: { title, due_at: isoAt(newDay, h.value.start), end_at: isoAt(newDay, h.value.end), priority: 2 } });
  } else {
    const values: Row = { action: "move", new_day: newDay, new_start: h.value.start, new_end: h.value.end };
    ops.push(existing ? { op: "update", table: "recurring_exceptions", id: existing.id, values, before: excRow(existing) } : { op: "insert", table: "recurring_exceptions", values: { rule_id: rule.id, day: target.day, ...values } });
  }
  return { ok: true, ops, done: [`Modifié (${dayText(target.day)} seulement) : ${title} ${newDay !== target.day ? `${dayText(newDay)} ` : ""}${rangeText(h.value.start, h.value.end)}`] };
}

// ---------- Supprimer ----------

export type DeleteInput = FindInput & { scope?: unknown };

export function planDelete(state: State, a: DeleteInput, now: Date): Plan {
  const t = one(state, a, now);
  if (!t.ok) return t;
  const target = t.value;
  if (target.kind === "task" || target.kind === "reminder") {
    const what = target.kind === "task" ? describe(target) : `pense-bête « ${target.task.title} »`;
    return { ok: true, ops: [{ op: "delete", table: "tasks", id: target.task.id, before: taskRow(target.task) }], done: [`Supprimé : ${what.replace(/^« (.*?) »/, "$1")}`] };
  }
  const rule = target.rule;
  const scope = a.scope === "once" || a.scope === "series" ? a.scope : target.day ? "once" : "series";
  if (scope === "series") return { ok: true, ops: [{ op: "delete", table: "recurring_tasks", id: rule.id, before: ruleRow(rule) }], done: [`Supprimé (toutes les semaines) : ${rule.title} ${daysLabel(ruleDays(rule))} ${rangeText(rule.at_time!, ruleEnd(rule))}`] };
  if (!target.day) return fail("pour « cette fois seulement », donne le jour (day)");
  const existing = state.exceptions.find((e) => e.rule_id === rule.id && e.day === target.day);
  const skip: Row = { action: "skip", new_day: null, new_start: null, new_end: null };
  return {
    ok: true,
    ops: [existing ? { op: "update", table: "recurring_exceptions", id: existing.id, values: skip, before: excRow(existing) } : { op: "insert", table: "recurring_exceptions", values: { rule_id: rule.id, day: target.day, ...skip } }],
    done: [`Supprimé (${dayText(target.day)} seulement) : ${rule.title} ${rangeText(rule.at_time!, ruleEnd(rule))}`],
  };
}

// ---------- Suppression en masse (après confirmation) ----------

export type BulkInput = { scope: "all" | "period"; from?: string; to?: string; include_reminders?: boolean };

/** Valide une demande de suppression en masse (jours calculés par le code). */
export function parseBulk(a: Record<string, unknown>, now: Date): Res<BulkInput> {
  const include = a.include_reminders !== false;
  if (a.scope === "all") return { ok: true, value: { scope: "all", include_reminders: include } };
  if (a.scope !== "period") return fail("scope doit être all ou period");
  const f = resolveDay(a.from, now);
  if (!f.ok) return f;
  const to = resolveDay(a.to ?? a.from, now);
  if (!to.ok) return to;
  if (to.value < f.value) return fail("to doit être après from");
  if (addDays(f.value, 62) < to.value) return fail("période trop longue (2 mois au plus)");
  return { ok: true, value: { scope: "period", from: f.value, to: to.value, include_reminders: include } };
}

/** Ce que « supprime tout » / « vide ma semaine » toucherait : le nombre exact, et les opérations. Rien n'est écrit tant que Ruben n'a pas confirmé. */
export function planBulk(state: State, b: BulkInput): { ops: Op[]; events: number; reminders: number; done: string } {
  const ops: Op[] = [];
  let events = 0;
  let reminders = 0;
  if (b.scope === "all") {
    for (const r of state.rules) {
      if (!isEventRule(r) && !b.include_reminders) continue; // pense-bêtes qui reviennent gardés
      ops.push({ op: "delete", table: "recurring_tasks", id: r.id, before: ruleRow(r) });
      if (isEventRule(r)) events++;
      else reminders++;
    }
    for (const t of state.tasks) {
      if (t.status !== "todo" && !(t.due_at && hasTime(t.due_at))) continue; // les pense-bêtes déjà cochés restent (historique)
      const isEvent = !!t.due_at && hasTime(t.due_at);
      if (!isEvent && !b.include_reminders) continue;
      ops.push({ op: "delete", table: "tasks", id: t.id, before: taskRow(t) });
      if (isEvent) events++;
      else reminders++;
    }
  } else {
    for (let d = b.from!; d <= b.to!; d = addDays(d, 1)) {
      for (const e of eventsOn(d, state.tasks, state.rules, state.exceptions)) {
        events++;
        if (e.source === "task") {
          const t = state.tasks.find((x) => x.id === e.id)!;
          ops.push({ op: "delete", table: "tasks", id: t.id, before: taskRow(t) });
        } else {
          const ex = state.exceptions.find((x) => x.rule_id === e.id && x.day === e.day);
          const skip: Row = { action: "skip", new_day: null, new_start: null, new_end: null };
          ops.push(ex ? { op: "update", table: "recurring_exceptions", id: ex.id, values: skip, before: excRow(ex) } : { op: "insert", table: "recurring_exceptions", values: { rule_id: e.id as number, day: e.day, ...skip } });
        }
      }
    }
    if (b.include_reminders) {
      for (const t of state.tasks) {
        if (t.status !== "todo" || !t.due_at || hasTime(t.due_at)) continue;
        const d = parisDay(new Date(t.due_at));
        if (d >= b.from! && d <= b.to!) {
          ops.push({ op: "delete", table: "tasks", id: t.id, before: taskRow(t) });
          reminders++;
        }
      }
    }
  }
  const parts = [plural(events, "événement"), ...(reminders ? [plural(reminders, "pense-bête")] : [])];
  return { ops, events, reminders, done: `J'ai supprimé ${parts.join(" et ")}${b.scope === "period" ? ` (du ${dayText(b.from!)} au ${dayText(b.to!)})` : ""}.` };
}

/** Phrase de la carte de confirmation, AVANT de supprimer. */
export const bulkQuestion = (p: { events: number; reminders: number }, b: BulkInput) =>
  `Supprimer ${plural(p.events, "événement")}${p.reminders ? ` et ${plural(p.reminders, "pense-bête")}` : ""}${b.scope === "period" ? ` du ${dayText(b.from!)} au ${dayText(b.to!)}` : ""} ?`;

// ---------- Appliquer en mémoire (tests, évaluation) ----------

/** Applique les opérations à un état en mémoire (même effet que la base). Renvoie le nouvel état. */
export function applyMemory(state: State, ops: Op[]): State {
  const s: State = { tasks: [...state.tasks], rules: [...state.rules], exceptions: [...state.exceptions] };
  const key = (t: Table) => (t === "tasks" ? "tasks" : t === "recurring_tasks" ? "rules" : "exceptions") as "tasks" | "rules" | "exceptions";
  let next = Math.max(0, ...s.tasks.map((x) => x.id), ...s.rules.map((x) => x.id), ...s.exceptions.map((x) => x.id)) + 1;
  for (const o of ops) {
    const list = s[key(o.table)] as { id: number }[];
    if (o.op === "insert") list.push({ ...(o.table === "tasks" ? { status: "todo" } : {}), ...(o.table === "recurring_tasks" ? { created_at: new Date(0).toISOString(), last_generated: null, month_day: null } : {}), ...o.values, id: next++ } as never);
    else if (o.op === "update") {
      const i = list.findIndex((x) => x.id === o.id);
      if (i >= 0) list[i] = { ...list[i], ...o.values } as never;
    } else {
      const i = list.findIndex((x) => x.id === o.id);
      if (i >= 0) list.splice(i, 1);
      if (o.table === "recurring_tasks") s.exceptions = s.exceptions.filter((e) => e.rule_id !== o.id); // comme « on delete cascade »
    }
  }
  return s;
}
