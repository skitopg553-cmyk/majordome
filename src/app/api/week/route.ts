import { NextResponse } from "next/server";
import { denied } from "@/lib/access";
import { runAgent } from "@/lib/ai";
import { mondayOf } from "@/lib/forme";
import { mirrorFacts, mirrorPrompt, noteIsGrounded, weekMirror } from "@/lib/mirror";
import { supabaseAdmin } from "@/lib/supabase";
import { addDays } from "@/lib/task-groups";

export const maxDuration = 30;

// Observation déjà écrite pour des chiffres identiques : pas de nouvel appel IA si Ruben rouvre l'écran (mémoire de l'instance, 6 h).
const cache = new Map<string, { note: string | null; at: number }>();

// « Ta semaine » : les CHIFFRES sont calculés en code (src/lib/mirror.ts) ; l'IA ne fait que 2-3 phrases à partir de ces chiffres,
// et une phrase qui cite un nombre absent des faits est jetée (noteIsGrounded). Lecture seule sur la base.
export async function GET(req: Request) {
  if (denied(req)) return NextResponse.json({ error: "Accès refusé" }, { status: 401 });
  const db = supabaseAdmin();
  const now = new Date();
  const from = addDays(mondayOf(now), -7); // la semaine d'avant sert à comparer les dépenses
  const [todo, done, tx, workouts, sleeps, meals] = await Promise.all([
    db.from("tasks").select("status,due_at,done_at").eq("status", "todo"),
    db.from("tasks").select("status,due_at,done_at").eq("status", "done").gte("done_at", `${from}T00:00:00Z`),
    db.from("transactions").select("date,label,amount,category").gte("date", from),
    db.from("workouts").select("date,kind,minutes").gte("date", from),
    db.from("sleep_logs").select("date,hours").gte("date", from),
    db.from("food_logs").select("date,kcal").gte("date", from), // facultatif : table de la migration 0011
  ]);
  const err = todo.error ?? done.error;
  if (err) return NextResponse.json({ error: err.message }, { status: 500 });
  // Finances / Forme absentes (migrations non appliquées) : leurs chiffres restent à zéro, rien n'est inventé.
  const mirror = weekMirror(
    {
      tasks: [...(todo.data ?? []), ...(done.data ?? [])],
      transactions: (tx.data ?? []).map((t) => ({ ...t, amount: Number(t.amount) })),
      workouts: workouts.data ?? [],
      sleeps: sleeps.error ? [] : (sleeps.data ?? []).map((s) => ({ date: s.date, hours: Number(s.hours) })),
      meals: meals.error ? [] : (meals.data ?? []).map((m) => ({ date: m.date, kcal: Number(m.kcal) })),
    },
    now,
  );

  const key = JSON.stringify(mirror);
  let hit = cache.get(key);
  if (!hit || Date.now() - hit.at > 6 * 3_600_000) {
    let note: string | null = null;
    try {
      const text = (await runAgent({ tier: "haiku", purpose: "miroir", system: "Tu écris en français, court et simple.", messages: [{ role: "user", content: mirrorPrompt(mirror) }], maxTokens: 300 })).trim();
      note = text && noteIsGrounded(text, mirror) ? text : null;
    } catch {
      note = null; // pas de clé IA / erreur : l'écran montre les chiffres sans commentaire
    }
    hit = { note, at: Date.now() };
    cache.set(key, hit);
  }
  return NextResponse.json({ mirror, facts: mirrorFacts(mirror), note: hit.note });
}
