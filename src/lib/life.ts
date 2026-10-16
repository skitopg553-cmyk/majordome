// Ce que l'IA a le droit d'écrire dans la vie de Ruben (Forme, budgets, dépenses) : validation en code, jamais par le LLM.
// Chaque fonction renvoie { ok: true, value } ou { ok: false, error } : l'erreur est un texte que le modèle lit et peut corriger.
import { categorizeByRules, CATEGORIES } from "./finance/categorize";
import { addDays, parisDay } from "./task-groups";
import { fold } from "./text";

type Res<T> = { ok: true; value: T } | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

/** Jour concerné : absent = aujourd'hui (Paris). Pas dans le futur, pas plus d'un an en arrière. */
/** Vrai pour un vrai jour du calendrier AAAA-MM-JJ (Date.parse accepte à tort « 2026-02-31 » : on vérifie l'aller-retour). */
export const isRealDay = (s: unknown): s is string =>
  typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(`${s}T12:00:00Z`).toISOString().slice(0, 10) === s;

export function resolveDate(arg: unknown, now: Date): Res<string> {
  const today = parisDay(now);
  if (arg === undefined || arg === null || arg === "") return { ok: true, value: today };
  if (!isRealDay(arg)) return fail("date invalide : format AAAA-MM-JJ attendu");
  if (arg > today) return fail("cette date est dans le futur : on ne note que ce qui est déjà fait");
  if (arg < addDays(today, -365)) return fail("date trop ancienne (plus d'un an)");
  return { ok: true, value: arg };
}

const int = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null);

export function parseWorkout(a: Record<string, unknown>, now: Date): Res<{ date: string; kind: string; minutes: number | null }> {
  const kind = typeof a.kind === "string" ? a.kind.trim().replace(/\s+/g, " ").slice(0, 60) : "";
  if (!kind) return fail("kind requis : le type de séance (ex. Musculation, Course à pied)");
  const minutes = a.minutes === undefined || a.minutes === null ? null : int(a.minutes);
  if (a.minutes != null && (minutes === null || minutes < 1 || minutes > 600)) return fail("minutes invalide : entre 1 et 600");
  const date = resolveDate(a.date, now);
  return date.ok ? { ok: true, value: { date: date.value, kind, minutes } } : date;
}

export function parseSleep(a: Record<string, unknown>, now: Date): Res<{ date: string; hours: number }> {
  const hours = typeof a.hours === "number" ? Math.round(a.hours * 100) / 100 : NaN;
  if (!(hours >= 1 && hours <= 16)) return fail("hours invalide : nombre d'heures entre 1 et 16 (ex. 7.5 pour 7 h 30)");
  const date = resolveDate(a.date, now); // date = jour du réveil
  return date.ok ? { ok: true, value: { date: date.value, hours } } : date;
}

export function parseSteps(a: Record<string, unknown>, now: Date): Res<{ date: string; steps: number; mode: "add" | "set" }> {
  const steps = int(a.steps);
  if (steps === null || steps < 1 || steps > 100000) return fail("steps invalide : entier entre 1 et 100000");
  const mode = a.mode === "set" ? "set" : "add"; // « j'ai fait 2 000 pas EN PLUS » (add) ou « j'en suis à 8 000 » (set)
  const date = resolveDate(a.date, now);
  return date.ok ? { ok: true, value: { date: date.value, steps, mode } } : date;
}

/** Catégorie exacte de l'app, retrouvée sans tenir compte des accents ni de la casse (« sport & sante » → « Sport & santé »). */
export const canonicalCategory = (c: unknown) => (typeof c === "string" ? CATEGORIES.find((x) => fold(x) === fold(c.trim())) ?? null : null);

export function parseBudget(a: Record<string, unknown>): Res<{ category: string; monthly_limit: number }> {
  const category = canonicalCategory(a.category);
  if (!category || category === "Revenu" || category === "Épargne") return fail(`catégorie inconnue ou sans budget. Catégories possibles : ${CATEGORIES.filter((c) => c !== "Revenu" && c !== "Épargne").join(", ")}`);
  const limit = typeof a.monthly_limit === "number" ? Math.round(a.monthly_limit * 100) / 100 : NaN;
  if (!(limit > 0 && limit <= 100000)) return fail("monthly_limit invalide : montant en euros entre 1 et 100000");
  return { ok: true, value: { category, monthly_limit: limit } };
}

/** Objectif d'épargne : nom + montant visé obligatoires ; « déjà épargné » et « pour quand » facultatifs (null = ne pas toucher). */
export function parseGoal(a: Record<string, unknown>): Res<{ label: string; target: number; saved: number | null; due_label: string | null }> {
  const label = typeof a.label === "string" ? a.label.trim().replace(/\s+/g, " ").slice(0, 80) : "";
  if (!label) return fail("label requis : le nom de l'objectif (ex. « Voiture »)");
  const target = typeof a.target === "number" ? Math.round(a.target * 100) / 100 : NaN;
  if (!(target > 0 && target <= 10_000_000)) return fail("target invalide : montant visé en euros, supérieur à 0");
  const saved = a.saved === undefined || a.saved === null ? null : typeof a.saved === "number" ? Math.round(a.saved * 100) / 100 : NaN;
  if (saved !== null && !(saved >= 0 && saved <= 10_000_000)) return fail("saved invalide : montant déjà épargné, 0 ou plus");
  const due = typeof a.due_label === "string" ? a.due_label.trim().slice(0, 40) : "";
  return { ok: true, value: { label, target, saved, due_label: due || null } };
}

/** Dépense ou revenu saisi à la main. Un montant négatif = dépense ; sans catégorie, les règles de catégorisation décident. */
export function parseExpense(a: Record<string, unknown>, now: Date): Res<{ date: string; label: string; amount: number; category: string }> {
  const label = typeof a.label === "string" ? a.label.trim().replace(/\s+/g, " ").slice(0, 120) : "";
  if (!label) return fail("label requis (ex. « Courses Carrefour »)");
  const amount = typeof a.amount === "number" ? Math.round(a.amount * 100) / 100 : NaN;
  if (!Number.isFinite(amount) || amount === 0 || Math.abs(amount) > 1_000_000) return fail("amount invalide : montant en euros, négatif pour une dépense, positif pour une entrée");
  const category = a.category != null ? canonicalCategory(a.category) : (categorizeByRules(label) ?? "Autre");
  if (!category) return fail(`catégorie inconnue. Catégories possibles : ${CATEGORIES.join(", ")}`);
  const date = resolveDate(a.date, now);
  return date.ok ? { ok: true, value: { date: date.value, label, amount, category } } : date;
}
