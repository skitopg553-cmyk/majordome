import { NextResponse } from "next/server";
import { denied } from "@/lib/access";
import { toSpokenText } from "@/lib/speech-text";
import { supabaseAdmin } from "@/lib/supabase";
import { parisDay, parisIso } from "@/lib/task-groups";
import { decideSpeak, maxCharsPerDay, ttsCostUsd } from "@/lib/voice-budget";

export const maxDuration = 30;

// Voix cloud (OpenAI gpt-4o-mini-tts). Renvoie de l'audio MP3, ou { fallback: true } : l'écran lit alors avec la voix du téléphone, sans message d'erreur.
// Protégée par le code d'accès. Le texte est nettoyé ici (balise d'humeur, markdown, emojis, chiffres et heures en toutes lettres) : voir src/lib/speech-text.ts.
// Plafond de caractères par jour (VOICE_MAX_CHARS_PER_DAY) ; chaque génération est journalisée dans ai_calls (purpose « tts », input_tokens = caractères).

const MODEL = "gpt-4o-mini-tts";
const VOICES = ["coral", "sage", "verse", "ash", "nova"] as const;
type Voice = (typeof VOICES)[number];

// Consigne de ton : la voix doit sonner comme un ami organisé, pas comme un GPS.
const TONE =
  "Parle en français de France, d'une voix posée et chaleureuse, comme un ami organisé et bienveillant. Rythme naturel avec de légères variations d'intonation et de vraies pauses entre les phrases ; jamais robotique, jamais monotone, jamais théâtral. Prononce les heures et les nombres naturellement.";

// Petites phrases répétées (« Ok, c'est fait. ») : gardées en mémoire de l'instance, pas refacturées.
const cache = new Map<string, ArrayBuffer>();
const CACHE_MAX = 100;
const CACHE_MAX_CHARS = 80;

async function usedToday(): Promise<number> {
  const r = await supabaseAdmin().from("ai_calls").select("input_tokens").eq("purpose", "tts").gte("created_at", parisIso(parisDay(new Date()), 0, 0)).limit(5000);
  if (r.error) return 0; // table absente ou illisible : on ne bloque pas la voix pour ça
  return (r.data ?? []).reduce((s, x) => s + (x.input_tokens ?? 0), 0);
}

export async function POST(req: Request) {
  if (denied(req)) return NextResponse.json({ error: "Accès refusé" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { text?: unknown; voice?: unknown; nocache?: unknown };
  const spoken = typeof body.text === "string" ? toSpokenText(body.text.slice(0, 4000)) : "";
  const voice: Voice = (VOICES as readonly string[]).includes(body.voice as string) ? (body.voice as Voice) : "coral";
  const key = process.env.OPENAI_API_KEY;
  if (!key) return NextResponse.json({ fallback: true, reason: "no-key" }, { status: 501 });
  if (!spoken) return new NextResponse(null, { status: 204 });

  const used = await usedToday();
  const headers = (extra: Record<string, string> = {}) => ({
    "Content-Type": "audio/mpeg",
    "Cache-Control": "no-store",
    "x-chars": String(spoken.length),
    "x-cost-usd": ttsCostUsd(spoken.length).toFixed(5),
    "x-used-today": String(used),
    "x-max-per-day": String(maxCharsPerDay()),
    "x-spoken": encodeURIComponent(spoken.slice(0, 600)),
    ...extra,
  });

  const cacheKey = `${voice}|${spoken}`;
  const hit = body.nocache === true ? undefined : cache.get(cacheKey);
  if (hit) return new NextResponse(hit, { headers: headers({ "x-cache": "hit", "x-cost-usd": "0" }) });

  const decision = decideSpeak({ enabled: true, usedToday: used, chars: spoken.length, maxPerDay: maxCharsPerDay() });
  if (decision.mode === "phone") return NextResponse.json({ fallback: true, reason: decision.reason }, { status: 429 }); // plafond : l'écran se replie en silence

  const t0 = Date.now();
  let upstream: Response;
  try {
    upstream = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: MODEL, voice, input: spoken, instructions: TONE, response_format: "mp3" }),
    });
  } catch {
    return NextResponse.json({ fallback: true, reason: "network" }, { status: 502 });
  }
  if (!upstream.ok || !upstream.body) {
    console.error("TTS OpenAI :", upstream.status); // jamais la clé ni le texte dans les logs
    return NextResponse.json({ fallback: true, reason: "service" }, { status: 502 });
  }

  // Journalisation : une ligne par génération (comme tous les appels IA).
  const log = () =>
    void supabaseAdmin().from("ai_calls").insert({ model: MODEL, purpose: "tts", input_tokens: spoken.length, output_tokens: 0, cost_usd: ttsCostUsd(spoken.length), duration_ms: Date.now() - t0 }).then(({ error }) => {
      if (error) console.error("Journalisation ai_calls (tts) échouée :", error.message);
    });

  if (spoken.length <= CACHE_MAX_CHARS) {
    const audio = await upstream.arrayBuffer();
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
    if (body.nocache !== true) cache.set(cacheKey, audio);
    log();
    return new NextResponse(audio, { headers: headers({ "x-cache": "miss" }) });
  }
  log();
  return new NextResponse(upstream.body, { headers: headers({ "x-cache": "miss" }) }); // longue phrase : l'audio part dès que le début arrive
}
