import { NextResponse } from "next/server";
import { denied } from "@/lib/access";
import { isMissingTable, supabaseAdmin } from "@/lib/supabase";

const isDay = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

// Sommeil et séances des 28 derniers jours. Sans la migration 0005 : { ready: false } → aperçu fictif.
export async function GET(req: Request) {
  if (denied(req)) return NextResponse.json({ error: "Accès refusé" }, { status: 401 });
  const db = supabaseAdmin();
  const since = new Date(Date.now() - 28 * 86_400_000).toISOString().slice(0, 10);
  const [sleeps, workouts] = await Promise.all([
    db.from("sleep_logs").select("date,hours").gte("date", since).order("date"),
    db.from("workouts").select("id,date,kind,minutes").gte("date", since).order("date"),
  ]);
  const error = sleeps.error ?? workouts.error;
  if (isMissingTable(error)) return NextResponse.json({ ready: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ready: true, sleeps: (sleeps.data ?? []).map((s) => ({ ...s, hours: Number(s.hours) })), workouts: workouts.data ?? [] });
}

// Saisie manuelle : { type: "sleep", date, hours } (remplace la nuit si déjà notée) ou { type: "workout", date, kind, minutes? }.
export async function POST(req: Request) {
  if (denied(req)) return NextResponse.json({ error: "Accès refusé" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { type?: string; date?: unknown; hours?: unknown; kind?: unknown; minutes?: unknown };
  if (!isDay(b.date)) return NextResponse.json({ error: "Date invalide" }, { status: 400 });
  const db = supabaseAdmin();

  let res;
  if (b.type === "sleep") {
    if (typeof b.hours !== "number" || b.hours <= 0 || b.hours > 16) return NextResponse.json({ error: "Durée de sommeil invalide" }, { status: 400 });
    res = await db.from("sleep_logs").upsert({ date: b.date, hours: Math.round(b.hours * 100) / 100 }, { onConflict: "date" });
  } else if (b.type === "workout") {
    const kind = typeof b.kind === "string" ? b.kind.trim().slice(0, 60) : "";
    if (!kind) return NextResponse.json({ error: "Type de séance requis" }, { status: 400 });
    if (b.minutes != null && (typeof b.minutes !== "number" || b.minutes <= 0 || b.minutes > 600)) return NextResponse.json({ error: "Durée invalide" }, { status: 400 });
    res = await db.from("workouts").insert({ date: b.date, kind, minutes: b.minutes ?? null });
  } else return NextResponse.json({ error: "type doit être sleep ou workout" }, { status: 400 });

  if (isMissingTable(res.error)) return NextResponse.json({ error: "Les tables Forme ne sont pas encore créées (migration 0005 à valider)." }, { status: 503 });
  if (res.error) return NextResponse.json({ error: res.error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
