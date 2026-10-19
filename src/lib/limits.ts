// Limites et validation des champs d'une tâche / d'un souvenir, partagées par les routes ET par les outils de l'IA :
// ce qu'on enregistre est toujours borné et propre, quelle que soit la source (formulaire, modèle, appel direct).
import { isRealDay } from "./life";

export const MAX_TITLE = 200;
export const MAX_NOTES = 2000;
export const MAX_MEMORY = 500;

/** Texte nettoyé (espaces de bord retirés, coupé à `max`), ou null si ce n'est pas du texte ou s'il est vide. */
export function clampText(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, max).trim();
  return t || null;
}

/**
 * Échéance stricte : « AAAA-MM-JJTHH:MM[:SS[.mmm]] » + fuseau (Z ou ±HH:MM), sur un vrai jour du calendrier.
 * Le fuseau est OBLIGATOIRE : sans lui, Postgres lirait l'heure comme de l'UTC et la tâche tomberait avec 1 h ou 2 h de décalage à Paris.
 * Renvoie le texte tel quel s'il est valide, sinon null.
 */
export function parseDueAt(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const m = v.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,6})?)?(Z|[+-](\d{2}):(\d{2}))$/);
  if (!m || !isRealDay(m[1])) return null;
  if (Number(m[2]) > 23 || Number(m[3]) > 59 || Number(m[4] ?? 0) > 59 || Number(m[6] ?? 0) > 14 || Number(m[7] ?? 0) > 59) return null;
  return Number.isNaN(Date.parse(v)) ? null : v;
}

export type TaskFields = { title?: string; due_at?: string; end_at?: string; priority?: number; notes?: string };
export type FieldsResult = { ok: true; fields: TaskFields } | { ok: false; error: string };

/** Champs d'une tâche issus d'une saisie ou d'un appel d'outil : bornés, validés. Seuls les champs présents sont renvoyés. */
export function taskFields(a: Record<string, unknown>, opts: { requireTitle: boolean }): FieldsResult {
  const fields: TaskFields = {};
  if (a.title !== undefined || opts.requireTitle) {
    const title = clampText(a.title, MAX_TITLE);
    if (!title) return { ok: false, error: "title requis (texte non vide)" };
    fields.title = title;
  }
  if (a.due_at !== undefined && a.due_at !== null) {
    const due = parseDueAt(a.due_at);
    if (!due) return { ok: false, error: "due_at invalide : date ISO 8601 AVEC fuseau, ex. 2026-10-16T10:00:00+02:00" };
    fields.due_at = due;
  }
  if (a.end_at !== undefined && a.end_at !== null) {
    const end = parseDueAt(a.end_at);
    if (!end) return { ok: false, error: "end_at invalide : date ISO 8601 AVEC fuseau, ex. 2026-10-16T12:00:00+02:00" };
    // La fin n'a de sens qu'avec un début, le même jour, plus tard (un créneau, pas un voyage).
    if (!fields.due_at) return { ok: false, error: "end_at demande aussi due_at (l'heure de début)" };
    if (Date.parse(end) <= Date.parse(fields.due_at) || Date.parse(end) - Date.parse(fields.due_at) > 86_400_000) return { ok: false, error: "end_at doit être après due_at, dans les 24 h" };
    fields.end_at = end;
  }
  if (a.priority !== undefined && a.priority !== null) {
    if (a.priority !== 1 && a.priority !== 2 && a.priority !== 3) return { ok: false, error: "priority invalide : 1 (haute), 2 (normale) ou 3 (basse)" };
    fields.priority = a.priority;
  }
  if (a.notes !== undefined && a.notes !== null) {
    const notes = clampText(a.notes, MAX_NOTES);
    if (notes) fields.notes = notes;
  }
  return { ok: true, fields };
}

export type TaskPatch = Record<string, string | number | null>;

/**
 * Modification d'une tâche depuis l'écran : { done } coche / décoche ; sinon des champs (title, due_at, priority, notes).
 * due_at: null retire l'échéance, notes: "" ou null efface les notes. Même validation que la création.
 */
export function taskPatch(b: Record<string, unknown>): { ok: true; patch: TaskPatch } | { ok: false; error: string } {
  if (typeof b.done === "boolean") return { ok: true, patch: b.done ? { status: "done", done_at: new Date().toISOString() } : { status: "todo", done_at: null } };
  const f = taskFields(b, { requireTitle: false });
  if (!f.ok) return f;
  const patch: TaskPatch = { ...f.fields };
  if (b.due_at === null) patch.due_at = null;
  if (b.notes === null || b.notes === "") patch.notes = null;
  return Object.keys(patch).length ? { ok: true, patch } : { ok: false, error: "rien à modifier" };
}
