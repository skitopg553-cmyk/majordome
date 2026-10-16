import { NextResponse } from "next/server";
import { denied } from "@/lib/access";
import { latestConnection, publicBank } from "@/lib/bank-store";
import { totalBalance } from "@/lib/finance/bank";
import { latestSnapshot } from "@/lib/finance/snapshot";
import { isMissingTable, supabaseAdmin } from "@/lib/supabase";

// Données Finances réelles : opérations des 120 derniers jours (90 j d'historique + le mois en cours), budgets, objectifs.
// Si la migration 0004 n'est pas appliquée : { ready: false } → l'app affiche l'aperçu fictif.
export async function GET(req: Request) {
  if (denied(req)) return NextResponse.json({ error: "Accès refusé" }, { status: 401 });
  const db = supabaseAdmin();
  const since = new Date(Date.now() - 120 * 86_400_000).toISOString().slice(0, 10);
  const [tx, budgets, goals] = await Promise.all([
    db.from("transactions").select("id,date,label,amount,category").gte("date", since).order("date", { ascending: false }),
    db.from("budgets").select("category,monthly_limit"),
    db.from("savings_goals").select("id,label,target,saved,due_label,image_url").order("created_at"),
  ]);
  const error = tx.error ?? budgets.error ?? goals.error;
  if (isMissingTable(error)) return NextResponse.json({ ready: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    ready: true,
    // Connexion bancaire : { ready:false } tant que la migration 0009 n'est pas appliquée (l'écran masque alors le bouton).
    bank: publicBank(await latestConnection(db), totalBalance),
    // Dernier solde lu dans un relevé importé (null tant que la migration 0010 n'est pas appliquée).
    snapshot: await latestSnapshot(db),
    // numeric arrive en texte depuis Postgres : on convertit une fois ici.
    transactions: (tx.data ?? []).map((t) => ({ ...t, amount: Number(t.amount) })),
    budgets: (budgets.data ?? []).map((b) => ({ category: b.category, limit: Number(b.monthly_limit) })),
    goals: (goals.data ?? []).map((g) => ({ ...g, target: Number(g.target), saved: Number(g.saved) })),
  });
}
