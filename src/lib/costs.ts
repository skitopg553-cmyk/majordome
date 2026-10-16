// Coût de l'IA, calculé en code à partir de la table ai_calls (jamais par le LLM). Jours et mois à l'heure de Paris.
import { parisDay } from "./task-groups";

export type CostRow = { model: string; cost_usd: number | string | null; created_at: string };
export type CostSummary = {
  today: { cost: number; calls: number };
  month: { cost: number; calls: number };
  byModel: { model: string; cost: number; calls: number }[];
  /** Appels du mois dont le coût est 0 : prix du modèle non renseigné (OpenAI : variables OPENAI_PRICE_*), donc le total peut être sous-estimé. */
  unpriced: number;
};

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

export function summarizeCosts(rows: CostRow[], now: Date): CostSummary {
  const today = parisDay(now);
  const month = today.slice(0, 7);
  const out: CostSummary = { today: { cost: 0, calls: 0 }, month: { cost: 0, calls: 0 }, byModel: [], unpriced: 0 };
  const by = new Map<string, { cost: number; calls: number }>();
  for (const r of rows) {
    const day = parisDay(new Date(r.created_at));
    if (day.slice(0, 7) !== month) continue; // le mois en cours seulement (le jour du 1er à 01 h de Paris est encore « le 30 » en UTC)
    const cost = Number(r.cost_usd) || 0;
    out.month.cost += cost;
    out.month.calls++;
    if (cost === 0) out.unpriced++;
    const m = by.get(r.model) ?? { cost: 0, calls: 0 };
    m.cost += cost;
    m.calls++;
    by.set(r.model, m);
    if (day === today) {
      out.today.cost += cost;
      out.today.calls++;
    }
  }
  out.today.cost = round6(out.today.cost);
  out.month.cost = round6(out.month.cost);
  out.byModel = [...by.entries()].map(([model, v]) => ({ model, cost: round6(v.cost), calls: v.calls })).sort((a, b) => b.cost - a.cost || b.calls - a.calls);
  return out;
}

/** « $0 », « <$0.01 », « $0.042 », « $3.20 » : lisible même pour de très petits montants. */
export function usd(n: number): string {
  if (n === 0) return "$0";
  if (n < 0.01) return "<$0.01";
  return n < 1 ? `$${n.toFixed(3)}` : `$${n.toFixed(2)}`;
}
