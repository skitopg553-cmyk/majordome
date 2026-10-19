// Tâches récurrentes : « tous les lundis », « chaque jour », « tous les mois le 5 ». Le texte est interprété ICI, en code (jamais par le LLM) ;
// le modèle ne fait que transmettre la phrase de Ruben. Une règle crée au plus UNE tâche par jour, au premier chargement de la journée.
import { fold } from "./text";
import { parisIso } from "./task-groups";

export type Rule = { kind: "daily" | "weekly" | "monthly"; weekday: number | null; month_day: number | null; days?: string | null }; // weekday : 1 = lundi … 7 = dimanche ; days : « 1,2,3,4,5 » (plusieurs jours, migration 0014)
export type StoredRule = Rule & { id: number; title: string; at_time: string | null; last_generated: string | null; end_time?: string | null; habit?: boolean | number; created_at?: string };
type Res<T> = { ok: true; value: T } | { ok: false; error: string };

const WEEKDAYS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

export function parseRecurrence(text: unknown): Res<Rule> {
  const t = typeof text === "string" ? fold(text).replace(/[’']/g, " ") : "";
  const day = WEEKDAYS.findIndex((d) => new RegExp(`\\b${d}s?\\b`).test(t));
  if (/\b(tous les jours|chaque jour|quotidien|tous les matins|tous les soirs|chaque matin|chaque soir)\b/.test(t)) return { ok: true, value: { kind: "daily", weekday: null, month_day: null } };
  if (day >= 0 && /\b(tous les|chaque|toutes les)\b/.test(t)) return { ok: true, value: { kind: "weekly", weekday: day + 1, month_day: null } };
  if (/\b(tous les mois|chaque mois|mensuel)/.test(t)) {
    const n = t.match(/\ble\s+(\d{1,2})/)?.[1];
    const d = n ? Number(n) : NaN;
    if (!(d >= 1 && d <= 31)) return { ok: false, error: "précise le jour du mois (ex. « tous les mois le 5 »)" };
    return { ok: true, value: { kind: "monthly", weekday: null, month_day: d } };
  }
  return { ok: false, error: "récurrence non comprise. Exemples : « tous les lundis », « chaque jour », « tous les mois le 5 »" };
}

/** Heure facultative « HH:MM » : sans elle, la tâche n'a pas d'heure (00:00 = tâche) ; avec elle, c'est un élément d'agenda. */
export function parseAtTime(v: unknown): Res<string | null> {
  if (v === undefined || v === null || v === "") return { ok: true, value: null };
  const m = typeof v === "string" ? v.match(/^([01]?\d|2[0-3]):([0-5]\d)$/) : null;
  return m ? { ok: true, value: `${m[1].padStart(2, "0")}:${m[2]}` } : { ok: false, error: "time invalide : format HH:MM (ex. 09:30)" };
}

const daysInMonth = (day: string) => new Date(Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)), 0)).getUTCDate();

/** Cette règle tombe-t-elle le jour donné (AAAA-MM-JJ) ? « le 31 » tombe le dernier jour des mois plus courts. */
export function occursOn(r: Rule, day: string) {
  if (r.kind === "daily") return true;
  if (r.kind === "weekly") {
    const dow = ((new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;
    return r.days ? r.days.split(",").map(Number).includes(dow) : dow === r.weekday;
  }
  return Number(day.slice(8)) === Math.min(r.month_day ?? 0, daysInMonth(day));
}

/** Échéance de l'occurrence du jour : à l'heure donnée, sinon minuit (tâche sans heure). */
export function dueAtFor(atTime: string | null, day: string) {
  const [h, m] = (atTime ?? "00:00").split(":").map(Number);
  return parisIso(day, h, m);
}

/**
 * Règles à matérialiser aujourd'hui : elles tombent aujourd'hui et n'ont pas déjà créé leur tâche. Seulement les règles SANS heure (pense-bêtes qui reviennent) :
 * une règle avec heure est un créneau, calculé à l'affichage (src/lib/slots.ts), jamais copié dans tasks.
 */
export const dueToday = (rules: StoredRule[], today: string) => rules.filter((r) => !r.at_time && r.last_generated !== today && occursOn(r, today));

export function ruleLabel(r: Rule & { at_time?: string | null }) {
  const at = r.at_time ? ` à ${r.at_time}` : "";
  return (r.kind === "daily" ? "chaque jour" : r.kind === "weekly" ? `chaque ${WEEKDAYS[(r.weekday ?? 1) - 1]}` : `le ${r.month_day} de chaque mois`) + at;
}
