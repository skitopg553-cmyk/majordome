// Calendrier : règles PURES (testées) partagées par l'écran, les routes et l'IA. Titres propres, jours, chevauchements, mise en page des pavés.
// Un ÉVÉNEMENT a un début et une fin ; il est ponctuel (table tasks, due_at + end_at) ou récurrent (recurring_tasks avec at_time + end_time + days).
// Un PENSE-BÊTE n'a pas d'heure (tasks sans heure, ou recurring_tasks sans at_time) : il se coche et n'apparaît jamais dans la grille.
import { hasTime, parisHM } from "./planning";
import type { StoredRule } from "./recurrence";
import { DAY_NAMES, occurrencesOn, type SlotException } from "./slots";
import { addDays, parisDay, parisIso } from "./task-groups";
import { fold } from "./text";

type Res<T> = { ok: true; value: T } | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

export const DEFAULT_MINUTES = 60; // durée par défaut quand aucune fin n'est connue

// ---------- Titres ----------

const DAYS_RE = DAY_NAMES.join("|");
/**
 * Titre court, sans jour ni moment de la journée : « Cours le lundi après-midi » → « Cours », « Travailler au Otacos le vendredi » → « Travailler au Otacos ».
 * Si tout disparaît (« Lundi »), le titre d'origine est gardé.
 */
export function cleanTitle(raw: string): string {
  const t = raw
    .replace(new RegExp(`\\b(?:(?:tous|toutes) les|chaque|ce|cette|le|les|du)?\\s*(?:${DAYS_RE})s?\\b`, "gi"), " ")
    .replace(/\b(?:le|en|du|ce|cet|cette|l')?\s*(?:matin|apr[eè]s-?midi|aprem|soir|soirée)\b/gi, " ")
    .replace(/\b(?:aujourd'hui|demain)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/(?:\s+|^)(?:le|la|les|de|du|des|au|à|a|et|,|-)$/i, "")
    .trim();
  const out = t || raw.trim();
  return (out.charAt(0).toUpperCase() + out.slice(1)).slice(0, 120);
}

/** Clé de comparaison : titre propre, sans accents, sans ponctuation, sans « rendez-vous », « chez » ni article au début. */
export const normTitle = (raw: string) =>
  fold(cleanTitle(raw))
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/^(?:rendez vous|rdv) +/, "") // « Rendez-vous dentiste » = « dentiste »
    .replace(/^(?:chez|avec) +/, "")
    .replace(/^(?:le|la|les|l|un|une) +/, "")
    .trim();

/** « Fin de cours », « Reprise », « Pause » ne sont pas des événements : c'est une heure de fin, ou un trou. */
export function refuseTitle(title: string): string | null {
  const n = normTitle(title);
  if (/^(fin|reprise|debut)\b/.test(n)) return `« ${title} » n'est pas un événement : c'est l'heure de début ou de fin du pavé voisin (mets-la dans start ou end de celui-ci).`;
  if (n === "pause") return "Une pause n'est pas un événement (sauf si Ruben le demande avec un titre précis, ex. « Pause déjeuner »).";
  return null;
}

// ---------- Heures ----------

export const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
export const fromMin = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
export const overlaps = (a: { start: string; end: string }, b: { start: string; end: string }) => toMin(a.start) < toMin(b.end) && toMin(b.start) < toMin(a.end);
export const hmOf = (iso: string) => {
  const { h, m } = parisHM(iso);
  return fromMin(h * 60 + m);
};
/** « 9 h », « 18 h 30 », « 9 h-12 h ». */
export const hourText = (hhmm: string) => (hhmm.endsWith(":00") ? `${Number(hhmm.slice(0, 2))} h` : `${Number(hhmm.slice(0, 2))} h ${hhmm.slice(3)}`);
export const rangeText = (start: string, end: string) => `${hourText(start)}-${hourText(end)}`;

// ---------- Jours ----------

const MONTHS = ["janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet", "aout", "septembre", "octobre", "novembre", "decembre"];
const isoDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(`${s}T12:00:00Z`).toISOString().slice(0, 10) === s;
const dow = (day: string) => ((new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7) + 1; // 1 = lundi

/**
 * Un jour dit en français → AAAA-MM-JJ, calculé par le CODE (l'IA ne calcule jamais une date).
 * « aujourd'hui », « ce soir », « demain », « après-demain », « jeudi » (le prochain, aujourd'hui compris), « lundi prochain », « 22 octobre », « 22/10 », « 2026-10-22 ».
 */
export function resolveDay(v: unknown, now: Date): Res<string> {
  const today = parisDay(now);
  if (v === undefined || v === null || v === "") return { ok: true, value: today };
  if (typeof v !== "string") return fail("day invalide");
  const t = fold(v).replace(/[’']/g, " ").trim();
  if (isoDay(t)) return { ok: true, value: t };
  if (/^(aujourd hui|ce soir|ce matin|cet apres-?midi|ce midi)$/.test(t)) return { ok: true, value: today };
  if (t === "demain" || t === "demain soir" || t === "demain matin") return { ok: true, value: addDays(today, 1) };
  if (t === "apres-demain" || t === "apres demain") return { ok: true, value: addDays(today, 2) };
  const dm = t.match(/(\d{1,2})(?:er)?\s*(?:\/\s*(\d{1,2})|\s+([a-z]+))/);
  if (dm) {
    const d = Number(dm[1]);
    const m = dm[2] ? Number(dm[2]) : MONTHS.indexOf(dm[3] ?? "") + 1;
    let y = Number(today.slice(0, 4));
    let s = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (m >= 1 && isoDay(s)) {
      if (s < addDays(today, -1)) s = `${++y}${s.slice(4)}`; // « 5 janvier » dit en décembre : l'année suivante
      return { ok: true, value: s };
    }
  }
  const w = DAY_NAMES.findIndex((d) => new RegExp(`\\b${d}s?\\b`).test(t));
  if (w >= 0) {
    let delta = (w + 1 - dow(today) + 7) % 7;
    if (/prochain/.test(t) && delta === 0) delta = 7;
    return { ok: true, value: addDays(today, delta) };
  }
  return fail(`jour non compris : « ${v} ». Exemples : « aujourd'hui », « demain », « jeudi », « 22 octobre ».`);
}

/** « jeudi 22 octobre ». */
export const dayText = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("fr-FR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });

// ---------- Ce que la grille affiche ----------

export type TaskLike = { id: number; title: string; due_at: string | null; end_at?: string | null; status: "todo" | "done" };
/** Un pavé de la grille : ponctuel (task), récurrent (rule) ou Google (lecture seule). */
export type CalEvent = { key: string; source: "task" | "rule" | "google"; id: number | string; title: string; day: string; start: string; end: string; recurring: boolean; habit: boolean; googleId?: string };

/** Les pavés d'un jour : événements ponctuels avec heure + occurrences des règles avec heure (exceptions appliquées). Fin absente : 1 h. Triés. */
export function eventsOn(day: string, tasks: TaskLike[], rules: StoredRule[], exceptions: SlotException[]): CalEvent[] {
  const out: CalEvent[] = [];
  for (const t of tasks) {
    if (!t.due_at || !hasTime(t.due_at) || parisDay(new Date(t.due_at)) !== day) continue;
    const start = hmOf(t.due_at);
    const end = t.end_at && parisDay(new Date(t.end_at)) === day ? hmOf(t.end_at) : fromMin(Math.min(toMin(start) + DEFAULT_MINUTES, 24 * 60 - 1));
    out.push({ key: `t${t.id}`, source: "task", id: t.id, title: t.title, day, start, end: toMin(end) > toMin(start) ? end : fromMin(Math.min(toMin(start) + DEFAULT_MINUTES, 1439)), recurring: false, habit: false });
  }
  for (const o of occurrencesOn(rules, exceptions, day)) {
    const start = hmOf(o.start);
    const end = o.end ? hmOf(o.end) : fromMin(Math.min(toMin(start) + DEFAULT_MINUTES, 1439));
    out.push({ key: `r${o.key}`, source: "rule", id: o.ruleId, title: o.title, day: o.originDay, start, end, recurring: true, habit: o.habit });
  }
  return out.sort((a, b) => a.start.localeCompare(b.start) || b.end.localeCompare(a.end));
}

/** Pense-bêtes d'un jour (sans heure) : datés de ce jour ; pour aujourd'hui, aussi ceux en retard et ceux sans date. */
export function remindersFor<T extends TaskLike>(day: string, tasks: T[], today: string): T[] {
  return tasks.filter((t) => {
    if (t.status !== "todo" || (t.due_at && hasTime(t.due_at))) return false;
    if (!t.due_at) return day === today;
    const d = parisDay(new Date(t.due_at));
    return d === day || (day === today && d < today);
  });
}

/**
 * Pavés qui se chevauchent : placés côte à côte. Pour chaque pavé : sa colonne et le nombre de colonnes de son groupe.
 * Groupe = pavés reliés par des chevauchements ; colonnes attribuées dans l'ordre de début (la première libre).
 */
export function layoutDay<E extends { key: string; start: string; end: string }>(events: E[]): Map<string, { col: number; cols: number }> {
  const sorted = [...events].sort((a, b) => toMin(a.start) - toMin(b.start) || toMin(b.end) - toMin(a.end));
  const out = new Map<string, { col: number; cols: number }>();
  let group: { key: string; col: number }[] = [];
  let colsEnd: number[] = [];
  let groupEnd = -1;
  const flush = () => {
    for (const g of group) out.set(g.key, { col: g.col, cols: colsEnd.length });
    group = [];
    colsEnd = [];
  };
  for (const e of sorted) {
    const s = toMin(e.start);
    const en = Math.max(toMin(e.end), s + 15); // un pavé très court occupe quand même un peu de place
    if (s >= groupEnd) {
      flush();
      groupEnd = -1;
    }
    let col = colsEnd.findIndex((end) => end <= s);
    if (col < 0) col = colsEnd.push(en) - 1;
    else colsEnd[col] = en;
    group.push({ key: e.key, col });
    groupEnd = Math.max(groupEnd, en);
  }
  flush();
  return out;
}

/** ISO d'un jour + heure (heure de Paris). */
export const isoAt = (day: string, hhmm: string) => parisIso(day, Number(hhmm.slice(0, 2)), Number(hhmm.slice(3, 5)));
