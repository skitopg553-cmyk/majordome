import { NextResponse } from "next/server";
import { denied } from "@/lib/access";
import { dueAtFor } from "@/lib/recurrence";
import { listRules } from "@/lib/recurring-store";
import { endOfWeek, parseSlotAction } from "@/lib/slots";
import { isMissingTable, supabaseAdmin } from "@/lib/supabase";
import { addDays, parisDay } from "@/lib/task-groups";

// Créneaux qui reviennent (règles de recurring_tasks avec heure), leurs exceptions et le journal des habitudes.
// L'écran calcule les occurrences lui-même (src/lib/slots.ts) : rien n'est créé jour par jour.
// Sans la migration 0014, les exceptions et le journal sont simplement vides (l'app marche comme avant).
export async function GET(req: Request) {
  if (denied(req)) return NextResponse.json({ error: "Accès refusé" }, { status: 401 });
  const db = supabaseAdmin();
  const rules = await listRules(db);
  if (!rules) return NextResponse.json({ ready: false });
  const since = addDays(parisDay(new Date()), -60);
  const [exc, logs] = await Promise.all([
    db.from("recurring_exceptions").select("rule_id,day,action,new_day,new_start,new_end").gte("day", since),
    db.from("habit_logs").select("rule_id,day,status").gte("day", since),
  ]);
  return NextResponse.json({ ready: true, rules, exceptions: exc.error ? [] : exc.data ?? [], logs: logs.error ? [] : logs.data ?? [] });
}

// Une occurrence supprimée ({action:"skip"}) ou déplacée ({action:"move"}) sans toucher la série ; ou la réponse au bilan d'une habitude ({action:"habit"}).
export async function POST(req: Request) {
  if (denied(req)) return NextResponse.json({ error: "Accès refusé" }, { status: 401 });
  const today = parisDay(new Date());
  const p = parseSlotAction((await req.json().catch(() => ({}))) as Record<string, unknown>, today);
  if (!p.ok) return NextResponse.json({ error: p.error }, { status: 400 });
  const a = p.value;
  const db = supabaseAdmin();
  const rule = (await listRules(db))?.find((r) => r.id === a.rule_id);
  if (!rule) return NextResponse.json({ error: "Créneau introuvable" }, { status: 404 });

  let error: { code?: string; message: string } | null = null;
  if (a.action === "skip" || a.action === "move") {
    const row: Record<string, string | number | null> = a.action === "skip" ? { rule_id: a.rule_id, day: a.day, action: "skip", new_day: null, new_start: null, new_end: null } : { rule_id: a.rule_id, day: a.day, action: "move", new_day: a.new_day, new_start: a.new_start, new_end: a.new_end };
    error = (await db.from("recurring_exceptions").upsert(row as never, { onConflict: "rule_id,day" })).error;
  } else {
    error = (await db.from("habit_logs").upsert({ rule_id: a.rule_id, day: a.day, status: a.status }, { onConflict: "rule_id,day" })).error;
    if (!error && a.then) {
      // « Non » puis « Demain » / « Cette semaine » : un élément ponctuel, la série ne bouge pas.
      const tomorrow = addDays(today, 1);
      const row =
        a.then === "tomorrow"
          ? { title: rule.title, due_at: dueAtFor(rule.at_time, tomorrow), ...(rule.end_time ? { end_at: dueAtFor(rule.end_time, tomorrow) } : {}), priority: 2 }
          : { title: `${rule.title} (à reprogrammer)`, due_at: dueAtFor(null, endOfWeek(today) > today ? endOfWeek(today) : tomorrow), priority: 2 };
      let ins = await db.from("tasks").insert(row);
      if (ins.error && "end_at" in row && isMissingTable(ins.error)) ins = await db.from("tasks").insert({ title: row.title, due_at: row.due_at, priority: 2 });
      error = ins.error;
    }
  }
  if (isMissingTable(error)) return NextResponse.json({ error: "La base n'est pas prête pour cela (migration 0014 à appliquer)." }, { status: 503 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
