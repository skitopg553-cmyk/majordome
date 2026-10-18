import { NextResponse } from "next/server";
import { denied } from "@/lib/access";
import { GoogleAuthError, listEvents } from "@/lib/google-api";
import { accessToken, forgetToken } from "@/lib/google-sync";
import { isRealDay } from "@/lib/life";
import { supabaseAdmin } from "@/lib/supabase";
import { parisIso } from "@/lib/task-groups";

// Vrais événements Google (lecture seule) entre deux jours : ?from=AAAA-MM-JJ&to=AAAA-MM-JJ (60 jours au plus).
export async function GET(req: Request) {
  if (denied(req)) return NextResponse.json({ error: "Accès refusé" }, { status: 401 });
  const q = new URL(req.url).searchParams;
  const from = q.get("from");
  const to = q.get("to");
  if (!isRealDay(from) || !isRealDay(to) || to < from) return NextResponse.json({ error: "Période invalide" }, { status: 400 });
  const a = new Date(`${from}T00:00:00Z`).getTime();
  const b = new Date(`${to}T00:00:00Z`).getTime();
  if (b - a > 60 * 86_400_000) return NextResponse.json({ error: "Période trop longue (60 jours au plus)" }, { status: 400 });
  try {
    const t = await accessToken(supabaseAdmin());
    if (t.state !== "ok") return NextResponse.json({ state: t.state, events: [] });
    const events = await listEvents(t.token, new Date(parisIso(from, 0, 0)), new Date(parisIso(to, 23, 59)));
    return NextResponse.json({ state: "ok", events });
  } catch (e) {
    if (e instanceof GoogleAuthError) {
      forgetToken();
      return NextResponse.json({ state: "reconnect", events: [] });
    }
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erreur Google" }, { status: 502 });
  }
}
