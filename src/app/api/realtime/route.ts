import { NextResponse } from "next/server";
import { denied } from "@/lib/access";
import { clampSessionSeconds, maxSecondsPerDay, REALTIME_INSTRUCTIONS, REALTIME_MODEL, realtimeCostUsd, remainingSeconds, TOKEN_TTL_SECONDS, usdPerMinute } from "@/lib/realtime";
import { supabaseAdmin } from "@/lib/supabase";
import { parisDay, parisIso } from "@/lib/task-groups";

export const maxDuration = 30;

// Prototype « conversation » (page /voix-test) : ce serveur crée un JETON TEMPORAIRE pour le modèle audio temps réel d'OpenAI ; la clé OpenAI ne part jamais dans le navigateur.
//   { action: "start" } → { secret, model, sessionId, remainingSeconds, usdPerMinute } ; refusé (429) quand le plafond de minutes du jour est atteint.
//   { action: "end", sessionId, seconds } → enregistre la durée et le coût estimé dans ai_calls (purpose « realtime », duration_ms = durée de la session).
// Chaque session est journalisée dès son ouverture (durée 0) puis complétée à la fin ; une session jamais terminée compte 0 (limite connue : voir docs/nuit-20-10.md).

const MODEL = process.env.REALTIME_MODEL?.trim() || REALTIME_MODEL;

async function usedMsToday(): Promise<number> {
  const r = await supabaseAdmin().from("ai_calls").select("duration_ms").eq("purpose", "realtime").gte("created_at", parisIso(parisDay(new Date()), 0, 0)).limit(2000);
  if (r.error) return 0; // table illisible : on ne bloque pas
  return (r.data ?? []).reduce((s, x) => s + (x.duration_ms ?? 0), 0);
}

export async function POST(req: Request) {
  if (denied(req)) return NextResponse.json({ error: "Accès refusé" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { action?: unknown; sessionId?: unknown; seconds?: unknown };
  const db = supabaseAdmin();

  if (body.action === "end") {
    if (typeof body.sessionId !== "number" || !Number.isSafeInteger(body.sessionId) || body.sessionId < 1) return NextResponse.json({ error: "sessionId invalide" }, { status: 400 });
    const seconds = clampSessionSeconds(body.seconds, maxSecondsPerDay());
    // Une session ne se termine qu'une fois (duration_ms = 0 au départ).
    const { data, error } = await db.from("ai_calls").update({ duration_ms: seconds * 1000, cost_usd: realtimeCostUsd(seconds) }).eq("id", body.sessionId).eq("purpose", "realtime").eq("duration_ms", 0).select("id");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, recorded: !!data?.length, seconds, costUsd: realtimeCostUsd(seconds) });
  }

  if (body.action !== "start") return NextResponse.json({ error: "action doit être start ou end" }, { status: 400 });
  const key = process.env.OPENAI_API_KEY;
  if (!key) return NextResponse.json({ error: "Pas de clé OpenAI sur le serveur." }, { status: 501 });
  const used = await usedMsToday();
  const left = remainingSeconds(used);
  if (!left) return NextResponse.json({ error: "Plafond de minutes du jour atteint pour la conversation.", remainingSeconds: 0 }, { status: 429 });

  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        expires_after: { anchor: "created_at", seconds: TOKEN_TTL_SECONDS },
        session: {
          type: "realtime",
          model: MODEL,
          instructions: REALTIME_INSTRUCTIONS,
          // « Maintenir pour parler » : pas de détection automatique de fin de phrase, c'est le doigt qui décide.
          audio: { input: { turn_detection: null, transcription: { model: "gpt-4o-mini-transcribe", language: "fr" } }, output: { voice: "marin" } },
        },
      }),
    });
  } catch {
    return NextResponse.json({ error: "OpenAI injoignable." }, { status: 502 });
  }
  if (!res.ok) {
    console.error("Realtime client_secrets :", res.status); // jamais la clé ni le jeton dans les logs
    return NextResponse.json({ error: `OpenAI a refusé d'ouvrir la session (${res.status}).` }, { status: 502 });
  }
  const j = (await res.json().catch(() => ({}))) as { value?: string; client_secret?: { value?: string } };
  const secret = j.value ?? j.client_secret?.value;
  if (!secret) return NextResponse.json({ error: "Réponse inattendue d'OpenAI (pas de jeton)." }, { status: 502 });

  const row = await db.from("ai_calls").insert({ model: `openai/${MODEL}`, purpose: "realtime", input_tokens: 0, output_tokens: 0, cost_usd: 0, duration_ms: 0 }).select("id").single();
  if (row.error) console.error("Journalisation ai_calls (realtime) échouée :", row.error.message);
  return NextResponse.json({ secret, model: MODEL, sessionId: row.data?.id ?? null, remainingSeconds: left, usdPerMinute: usdPerMinute() }, { headers: { "Cache-Control": "no-store" } });
}
