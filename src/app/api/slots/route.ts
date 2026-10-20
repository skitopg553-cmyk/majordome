import { NextResponse } from "next/server";
import { denied } from "@/lib/access";
import { dueAtFor } from "@/lib/recurrence";
import { listRules } from "@/lib/recurring-store";
import { hasTime, parisHM } from "@/lib/planning";
import { askSportAI } from "@/lib/sport-ai";
import { canonicalSport, classifySport, recordHabitSession, type WorkoutStore } from "@/lib/sports";
import { endOfWeek, parseSlotAction } from "@/lib/slots";
import { isMissingTable, supabaseAdmin } from "@/lib/supabase";
import { addDays, parisDay } from "@/lib/task-groups";

const hm = (iso: string) => {
  const { h, m } = parisHM(iso);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

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
  // Séances de sport ponctuelles (« demain je vais courir à 7 h ») : pour leur bilan et la régularité de Forme. Sans la colonne habit_status (migration 0015), on lit sans elle.
  const cols = "id,title,due_at,end_at,status,habit_status";
  let t = await db.from("tasks").select(cols).gte("due_at", `${since}T00:00:00Z`);
  if (t.error) t = (await db.from("tasks").select("id,title,due_at,end_at,status").gte("due_at", `${since}T00:00:00Z`)) as unknown as typeof t;
  const oneoffs = (t.data ?? []).filter((x) => x.due_at && hasTime(x.due_at) && classifySport(x.title).kind === "sport");
  return NextResponse.json({ ready: true, rules, exceptions: exc.error ? [] : exc.data ?? [], logs: logs.error ? [] : logs.data ?? [], oneoffs });
}

type Db = ReturnType<typeof supabaseAdmin>;

/** Les séances de Forme vues par recordHabitSession : « déjà une séance de ce sport ce jour-là ? » et « ajoute-la ». */
const workouts = (db: Db): WorkoutStore => ({
  has: async (date, kind) => ((await db.from("workouts").select("kind").eq("date", date)).data ?? []).some((w) => canonicalSport(w.kind) === kind),
  add: async (w) => {
    const r = await db.from("workouts").insert(w);
    if (r.error) throw new Error(r.error.message);
  },
});

/** « Non » puis « Demain » / « Cette semaine » : un élément ponctuel, la série ne bouge pas. */
async function reprogram(db: Db, then: "tomorrow" | "week", title: string, at: string | null, end: string | null, today: string) {
  const tomorrow = addDays(today, 1);
  const row =
    then === "tomorrow"
      ? { title, due_at: dueAtFor(at, tomorrow), ...(end ? { end_at: dueAtFor(end, tomorrow) } : {}), priority: 2 }
      : { title: `${title} (à reprogrammer)`, due_at: dueAtFor(null, endOfWeek(today) > today ? endOfWeek(today) : tomorrow), priority: 2 };
  let ins = await db.from("tasks").insert(row);
  if (ins.error && "end_at" in row && isMissingTable(ins.error)) ins = await db.from("tasks").insert({ title: row.title, due_at: row.due_at, priority: 2 });
  return ins.error;
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
  } else if (a.task_id) {
    // Séance ponctuelle : la réponse est gardée sur la tâche (colonne habit_status, migration 0015).
    const t = await db.from("tasks").select("id,title,due_at,end_at,habit_status").eq("id", a.task_id).maybeSingle();
    if (isMissingTable(t.error)) return NextResponse.json({ error: "La base n'est pas prête pour cela (migration 0015 à appliquer)." }, { status: 503 });
    if (!t.data) return NextResponse.json({ error: "Séance introuvable" }, { status: 404 });
    error = (await db.from("tasks").update({ habit_status: a.status, status: "done", done_at: new Date().toISOString() }).eq("id", a.task_id)).error;
    if (!error && a.status === "done" && t.data.due_at) {
      await recordHabitSession({ title: t.data.title, at_time: hm(t.data.due_at), end_time: t.data.end_at ? hm(t.data.end_at) : null }, a.day, workouts(db), { alreadyDone: t.data.habit_status === "done", askAI: askSportAI }).catch((e) => console.error("séance :", e instanceof Error ? e.message : e));
    }
    if (!error && a.then && t.data.due_at) error = await reprogram(db, a.then, t.data.title, hm(t.data.due_at), t.data.end_at ? hm(t.data.end_at) : null, today);
  } else {
    const prev = await db.from("habit_logs").select("status").eq("rule_id", a.rule_id).eq("day", a.day).maybeSingle();
    error = (await db.from("habit_logs").upsert({ rule_id: a.rule_id, day: a.day, status: a.status }, { onConflict: "rule_id,day" })).error;
    if (!error && a.status === "done") {
      // « Oui » → une séance dans Forme (si c'est du sport). Le jour et les heures sont ceux de l'occurrence, déplacée ou non.
      const mv = (await db.from("recurring_exceptions").select("new_day,new_start,new_end").eq("rule_id", a.rule_id).eq("day", a.day).eq("action", "move").maybeSingle()).data;
      const start = mv?.new_start ?? rule.at_time;
      const end = mv?.new_end ?? (!mv?.new_start ? rule!.end_time ?? null : null);
      await recordHabitSession({ title: rule!.title, at_time: start, end_time: end }, mv?.new_day ?? a.day, workouts(db), { alreadyDone: prev.data?.status === "done", askAI: askSportAI }).catch((e) => console.error("séance :", e instanceof Error ? e.message : e));
    }
    if (!error && a.then) error = await reprogram(db, a.then, rule!.title, rule!.at_time, rule!.end_time ?? null, today);
  }
  if (isMissingTable(error)) return NextResponse.json({ error: "La base n'est pas prête pour cela (migration 0014 à appliquer)." }, { status: 503 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
