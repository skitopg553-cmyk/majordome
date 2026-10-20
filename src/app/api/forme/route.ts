import { NextResponse } from "next/server";
import { denied } from "@/lib/access";
import { isRealDay as isDay } from "@/lib/life";
import { isMissingTable, supabaseAdmin } from "@/lib/supabase";
import { sleepHours } from "@/lib/sleep";
import { parisDay } from "@/lib/task-groups";

// Sommeil et séances des 28 derniers jours. Sans la migration 0005 : { ready: false } (l'écran affiche un message, rien d'inventé).
export async function GET(req: Request) {
  if (denied(req)) return NextResponse.json({ error: "Accès refusé" }, { status: 401 });
  const db = supabaseAdmin();
  const since = new Date(Date.now() - 28 * 86_400_000).toISOString().slice(0, 10);
  const today = parisDay(new Date());
  const [sleeps, workouts, steps, food, goals, screen] = await Promise.all([
    db.from("sleep_logs").select("date,hours,bed_time,wake_time,quality").gte("date", since).order("date"), // heures et qualité : migration 0017 (sinon relu sans)
    db.from("workouts").select("id,date,kind,minutes").gte("date", since).order("date"),
    db.from("steps_logs").select("date,steps").gte("date", since).order("date"),
    db.from("food_logs").select("id,label,grams,kcal,protein,carbs,fat,estimated,created_at").eq("date", today).order("id"),
    db.from("nutrition_goals").select("kcal,protein,carbs,fat").eq("id", 1).maybeSingle(),
    db.from("screen_time_logs").select("date,minutes").gte("date", since).order("date"),
  ]);
  if (sleeps.error && isMissingTable(sleeps.error)) {
    const legacy = await db.from("sleep_logs").select("date,hours").gte("date", since).order("date");
    if (!legacy.error) Object.assign(sleeps, { data: legacy.data, error: null });
  }
  const error = sleeps.error ?? workouts.error;
  if (isMissingTable(error)) return NextResponse.json({ ready: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // Les pas sont facultatifs : sans leur table (migration 0008), le reste de l'écran marche quand même.
  return NextResponse.json({ ready: true, sleeps: (sleeps.data ?? []).map((s) => ({ ...s, hours: Number(s.hours) })), workouts: workouts.data ?? [], steps: steps.error ? [] : steps.data ?? [], screen: screen.error ? [] : screen.data ?? [], // temps d'écran réel (coque Android) : facultatif
    // Nutrition (migration 0011) : facultatifs, l'écran marche sans. numeric arrive en texte → converti ici.
    nutrition: food.error ? null : { meals: (food.data ?? []).map((m) => ({ id: m.id, created_at: m.created_at, label: m.label, grams: Number(m.grams), kcal: Number(m.kcal), protein: Number(m.protein), carbs: Number(m.carbs), fat: Number(m.fat), estimated: Number(m.estimated) })), goals: goals.error ? null : goals.data },
  });
}

// Saisie manuelle : { type: "sleep", date, hours } (remplace la nuit si déjà notée) ou { type: "workout", date, kind, minutes? }.
export async function POST(req: Request) {
  if (denied(req)) return NextResponse.json({ error: "Accès refusé" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { type?: string; date?: unknown; hours?: unknown; kind?: unknown; minutes?: unknown; id?: unknown; bed?: unknown; wake?: unknown; quality?: unknown };
  if (!isDay(b.date)) return NextResponse.json({ error: "Date invalide" }, { status: 400 });
  const db = supabaseAdmin();

  let res;
  if (b.type === "sleep") {
    // Carte du matin : coucher + lever (la durée est calculée ici, en code) et qualité en un tap ; sinon la durée seule, comme avant.
    const hours = typeof b.hours === "number" ? b.hours : sleepHours(b.bed, b.wake);
    if (typeof hours !== "number" || !(hours > 0 && hours <= 16)) return NextResponse.json({ error: "Durée de sommeil invalide" }, { status: 400 });
    const row = { date: b.date, hours: Math.round(hours * 100) / 100 };
    const details = sleepHours(b.bed, b.wake) !== null ? { bed_time: b.bed as string, wake_time: b.wake as string } : {};
    const q = b.quality === 1 || b.quality === 2 || b.quality === 3 ? { quality: b.quality } : {};
    res = await db.from("sleep_logs").upsert({ ...row, ...details, ...q }, { onConflict: "date" });
    if (res.error && isMissingTable(res.error)) res = await db.from("sleep_logs").upsert(row, { onConflict: "date" }); // migration 0017 absente : la durée seule
  } else if (b.type === "workout-minutes") {
    // Corriger la durée d'une séance (celle du créneau reprise au « oui » n'est pas toujours la bonne).
    if (typeof b.id !== "number" || !Number.isSafeInteger(b.id) || b.id < 1) return NextResponse.json({ error: "id invalide" }, { status: 400 });
    if (typeof b.minutes !== "number" || b.minutes < 1 || b.minutes > 600) return NextResponse.json({ error: "Durée invalide" }, { status: 400 });
    res = await db.from("workouts").update({ minutes: Math.round(b.minutes) }).eq("id", b.id);
  } else if (b.type === "workout") {
    const kind = typeof b.kind === "string" ? b.kind.trim().slice(0, 60) : "";
    if (!kind) return NextResponse.json({ error: "Type de séance requis" }, { status: 400 });
    if (b.minutes != null && (typeof b.minutes !== "number" || b.minutes <= 0 || b.minutes > 600)) return NextResponse.json({ error: "Durée invalide" }, { status: 400 });
    res = await db.from("workouts").insert({ date: b.date, kind, minutes: b.minutes ?? null });
  } else return NextResponse.json({ error: "type doit être sleep, workout ou workout-minutes" }, { status: 400 });

  if (isMissingTable(res.error)) return NextResponse.json({ error: "Les tables Forme ne sont pas encore créées (migration 0005 à valider)." }, { status: 503 });
  if (res.error) return NextResponse.json({ error: res.error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
