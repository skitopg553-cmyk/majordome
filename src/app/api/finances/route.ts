import { NextResponse } from "next/server";
import { denied } from "@/lib/access";
import { latestConnection, publicBank } from "@/lib/bank-store";
import { totalBalance } from "@/lib/finance/bank";
import { goalAdvice, savingsCapacity } from "@/lib/finance/savings";
import { latestSnapshot } from "@/lib/finance/snapshot";
import { isMissingTable, supabaseAdmin } from "@/lib/supabase";
import { parisDay } from "@/lib/task-groups";

// Données Finances réelles : opérations des 135 derniers jours (90 j d'historique + le mois en cours), budgets, objectifs.
// Si la migration 0004 n'est pas appliquée : { ready: false } → l'app affiche l'aperçu fictif.
export async function GET(req: Request) {
  if (denied(req)) return NextResponse.json({ error: "Accès refusé" }, { status: 401 });
  const db = supabaseAdmin();
  const since = new Date(Date.now() - 135 * 86_400_000).toISOString().slice(0, 10);
  const [tx, budgets, goals_] = await Promise.all([
    db.from("transactions").select("id,date,label,amount,category").gte("date", since).order("date", { ascending: false }),
    db.from("budgets").select("category,monthly_limit"),
    db.from("savings_goals").select("id,label,target,saved,due_label,image_url").order("created_at"),
  ]);
  const error = tx.error ?? budgets.error ?? goals_.error;
  if (isMissingTable(error)) return NextResponse.json({ ready: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const transactions = (tx.data ?? []).map((t) => ({ ...t, amount: Number(t.amount) }));
  const goals = (goals_.data ?? []).map((g) => ({ ...g, target: Number(g.target), saved: Number(g.saved) }));
  const today = parisDay(new Date());
  const capacity = savingsCapacity(transactions, today); // calculé en code sur les 3 derniers mois complets
  return NextResponse.json({
    ready: true,
    savings: { capacity, saved: Math.round(goals.reduce((s, g) => s + g.saved, 0)), advice: goals.filter((g) => g.due_label).map((g) => goalAdvice(g, capacity.free, today)) },
    // Connexion bancaire : { ready:false } tant que la migration 0009 n'est pas appliquée (l'écran masque alors le bouton).
    bank: publicBank(await latestConnection(db), totalBalance),
    // Dernier solde lu dans un relevé importé (null tant que la migration 0010 n'est pas appliquée).
    snapshot: await latestSnapshot(db),
    // numeric arrive en texte depuis Postgres : on convertit une fois ici.
    transactions,
    budgets: (budgets.data ?? []).map((b) => ({ category: b.category, limit: Number(b.monthly_limit) })),
    goals,
  });
}
