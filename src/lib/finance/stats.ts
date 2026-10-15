// Calculs financiers en code (jamais par le LLM). Montant < 0 = dépense.

export type Tx = { id?: number | string; date: string; label: string; amount: number; category: string }; // date AAAA-MM-JJ
export type Budget = { category: string; limit: number };

const month = (date: string) => date.slice(0, 7); // « 2026-10 »
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Dépenses (positives) et revenus du mois donné (« AAAA-MM »). Les virements vers l'épargne ne sont pas des dépenses. */
export function monthTotals(txs: Tx[], ym: string) {
  let spent = 0;
  let income = 0;
  for (const t of txs) {
    if (month(t.date) !== ym || t.category === "Épargne") continue;
    if (t.amount < 0) spent += -t.amount;
    else income += t.amount;
  }
  return { spent: round2(spent), income: round2(income) };
}

/** Dépenses du mois par catégorie, avec le budget s'il existe ; triées de la plus grosse à la plus petite. */
export function spendingByCategory(txs: Tx[], ym: string, budgets: Budget[] = []) {
  const map = new Map<string, number>();
  for (const t of txs) if (month(t.date) === ym && t.amount < 0 && t.category !== "Épargne") map.set(t.category, (map.get(t.category) ?? 0) - t.amount);
  for (const b of budgets) if (!map.has(b.category)) map.set(b.category, 0);
  return [...map.entries()]
    .map(([category, spent]) => {
      const limit = budgets.find((b) => b.category === category)?.limit ?? null;
      return { category, spent: round2(spent), limit, over: limit !== null && spent > limit };
    })
    .sort((a, b) => b.spent - a.spent);
}

export function median(values: number[]) {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const DAY = 86_400_000;
const time = (date: string) => new Date(`${date}T12:00:00Z`).getTime();

/**
 * « Dépense inhabituelle » : plus de 2× la médiane des dépenses de sa catégorie sur les 90 jours qui la précèdent.
 * Il faut au moins 3 dépenses de comparaison, sinon on ne juge pas (pas de fausse alerte au début).
 */
export function isUnusual(t: Tx, history: Tx[]) {
  if (t.amount >= 0) return false;
  const start = time(t.date) - 90 * DAY;
  const past = history
    .filter((h) => h !== t && h.id !== t.id && h.amount < 0 && h.category === t.category && time(h.date) >= start && time(h.date) <= time(t.date))
    .map((h) => -h.amount);
  if (past.length < 3) return false;
  return -t.amount > 2 * median(past);
}

/** Dépenses inhabituelles du mois donné, les plus récentes d'abord. */
export function unusualExpenses(txs: Tx[], ym: string) {
  return txs.filter((t) => month(t.date) === ym && isUnusual(t, txs)).sort((a, b) => b.date.localeCompare(a.date));
}

/** Progression d'un objectif d'épargne, bornée à 0–100 %. */
export const goalProgress = (saved: number, target: number) => (target > 0 ? Math.max(0, Math.min(100, Math.round((saved / target) * 100))) : 0);
