// Épargne : tout est calculé en code (jamais par le LLM). Montant < 0 = dépense, comme dans stats.ts.
import { median, type Tx } from "./stats";
import { fold } from "../text";

const round2 = (n: number) => Math.round(n * 100) / 100;
const round0 = (n: number) => Math.round(n);

// ---------- Retrouver un objectif à partir d'un nom dit à la voix ----------

export type Goal = { id: number; label: string; target: number; saved: number; due_label: string | null };
export type GoalMatch = { kind: "one"; goal: Goal } | { kind: "ambiguous"; candidates: Goal[] } | { kind: "none" };

/** « la voiture » retrouve « Voiture » ; deux objectifs possibles → ambigu (l'IA pose la question) ; aucun → none. */
export function matchGoal(goals: Goal[], query: string): GoalMatch {
  const stop = new Set(["la", "le", "les", "l", "un", "une", "mon", "ma", "mes", "de", "du", "des", "pour", "sur", "objectif"]);
  const words = (s: string) => fold(s).split(/[^a-z0-9]+/).filter((w) => w && !stop.has(w));
  const q = words(query);
  if (!q.length) return { kind: "none" };
  const exact = goals.filter((g) => words(g.label).join(" ") === q.join(" "));
  if (exact.length === 1) return { kind: "one", goal: exact[0] };
  // Mot commun (ou début de mot, « vacance » ~ « vacances ») : plusieurs résultats = ambigu.
  const close = (a: string, b: string) => a === b || (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a)));
  const found = goals.filter((g) => words(g.label).some((w) => q.some((x) => close(w, x))));
  if (found.length === 1) return { kind: "one", goal: found[0] };
  return found.length ? { kind: "ambiguous", candidates: found } : { kind: "none" };
}

// ---------- Capacité d'épargne ----------

/** Libellé réduit à son noyau : sans accents, chiffres ni dates, pour reconnaître « NETFLIX 12/10 » et « NETFLIX 12/11 » comme le même. */
export const labelKey = (label: string) => fold(label).replace(/[0-9]+/g, " ").replace(/[^a-z]+/g, " ").trim();

const monthOf = (date: string) => date.slice(0, 7);
function previousMonths(today: string, n: number) {
  let y = Number(today.slice(0, 4));
  let m = Number(today.slice(5, 7));
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    m--;
    if (m === 0) { m = 12; y--; }
    out.push(`${y}-${String(m).padStart(2, "0")}`);
  }
  return out;
}

export type Capacity = {
  months: number; // mois pris en compte (avec au moins une opération)
  income: number; // revenus moyens par mois
  fixed: number; // charges fixes par mois
  variable: number; // dépenses variables (médiane mensuelle)
  margin: number; // 10 % des revenus
  free: number; // « Libre » : ce qu'on peut mettre de côté par mois (jamais négatif)
};

const SIMILAR = 0.15; // un montant est « proche » à ±15 % de la médiane du libellé

/**
 * Sur les 3 derniers mois COMPLETS (le mois en cours n'est pas fini, il fausserait les moyennes) :
 * Libre = revenus moyens − charges fixes − dépenses variables (médiane mensuelle) − marge de 10 % des revenus.
 * Charge fixe = même libellé dans au moins 2 mois, montants à ±15 % de leur médiane.
 * Les virements vers l'épargne ne comptent ni en revenu ni en dépense.
 */
export function savingsCapacity(txs: Tx[], today: string): Capacity {
  const wanted = previousMonths(today, 3);
  const inRange = txs.filter((t) => wanted.includes(monthOf(t.date)) && t.category !== "Épargne");
  const months = wanted.filter((m) => inRange.some((t) => monthOf(t.date) === m));
  const N = months.length;
  if (!N) return { months: 0, income: 0, fixed: 0, variable: 0, margin: 0, free: 0 };

  const incomeByMonth = months.map((m) => inRange.filter((t) => monthOf(t.date) === m && t.amount > 0).reduce((s, t) => s + t.amount, 0));
  const income = incomeByMonth.reduce((a, b) => a + b, 0) / N;

  const expenses = inRange.filter((t) => t.amount < 0);
  const groups = new Map<string, Tx[]>();
  for (const t of expenses) {
    const k = labelKey(t.label);
    if (k) groups.set(k, [...(groups.get(k) ?? []), t]);
  }
  const fixedTxs = new Set<Tx>();
  for (const list of groups.values()) {
    const med = median(list.map((t) => -t.amount));
    const near = list.filter((t) => Math.abs(-t.amount - med) <= med * SIMILAR);
    if (new Set(near.map((t) => monthOf(t.date))).size >= 2) near.forEach((t) => fixedTxs.add(t));
  }
  const sum = (list: Tx[]) => list.reduce((s, t) => s - t.amount, 0);
  const fixed = sum([...fixedTxs]) / N;
  const variable = median(months.map((m) => sum(expenses.filter((t) => monthOf(t.date) === m && !fixedTxs.has(t)))));
  const margin = income * 0.1;
  const free = Math.max(0, income - fixed - variable - margin);
  return { months: N, income: round0(income), fixed: round0(fixed), variable: round0(variable), margin: round0(margin), free: round0(free) };
}

// ---------- Mensualité nécessaire par objectif ----------

const MONTHS = ["janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet", "aout", "septembre", "octobre", "novembre", "decembre"];

/** « Juin », « juin 2027 », « Avril » → mois cible (AAAA-MM), ou null si on ne comprend pas. Sans année : la prochaine occurrence (le mois en cours compte). */
export function parseDueMonth(label: string | null, today: string): string | null {
  if (!label) return null;
  const t = fold(label);
  const idx = MONTHS.findIndex((m) => t.includes(m) || (m.length > 4 && t.includes(m.slice(0, 4) + ".")));
  if (idx < 0) return null;
  const year = t.match(/\b(20\d{2})\b/)?.[1];
  const todayY = Number(today.slice(0, 4));
  const todayM = Number(today.slice(5, 7));
  const y = year ? Number(year) : idx + 1 >= todayM ? todayY : todayY + 1;
  return `${y}-${String(idx + 1).padStart(2, "0")}`;
}

/** Mois restants jusqu'au mois cible, au moins 1 (on a besoin d'au moins un versement). Null si le mois est déjà passé. */
export function monthsLeft(dueMonth: string, today: string): number | null {
  const diff = (Number(dueMonth.slice(0, 4)) - Number(today.slice(0, 4))) * 12 + (Number(dueMonth.slice(5, 7)) - Number(today.slice(5, 7)));
  return diff < 0 ? null : Math.max(1, diff);
}

export type GoalAdvice = { label: string; needed: number | null; monthsLeft: number | null; text: string };

/** Une phrase simple par objectif : mensualité nécessaire = (cible − épargné) ÷ mois restants, comparée au « Libre ». */
export function goalAdvice(goal: Goal, free: number, today: string): GoalAdvice {
  const remaining = round2(goal.target - goal.saved);
  if (remaining <= 0) return { label: goal.label, needed: 0, monthsLeft: null, text: `${goal.label} : objectif atteint.` };
  const due = parseDueMonth(goal.due_label, today);
  if (!due) return { label: goal.label, needed: null, monthsLeft: null, text: `${goal.label} : il reste ${round0(remaining)} €, pas de date, rien à comparer.` };
  const left = monthsLeft(due, today);
  if (left === null) return { label: goal.label, needed: null, monthsLeft: null, text: `${goal.label} : la date est passée, il reste ${round0(remaining)} €.` };
  const needed = Math.ceil(remaining / left);
  const head = `${goal.label} : ${needed} €/mois nécessaires, ${free} € dispo`;
  if (needed <= free) return { label: goal.label, needed, monthsLeft: left, text: `${head} → c'est tenable.` };
  if (free <= 0) return { label: goal.label, needed, monthsLeft: left, text: `${head} → rien de libre pour l'instant : réduisez vos dépenses avant.` };
  const delay = Math.ceil(remaining / free) - left;
  return { label: goal.label, needed, monthsLeft: left, text: `${head} → décalez de ${delay} mois ou réduisez vos sorties de ${needed - free} €.` };
}
