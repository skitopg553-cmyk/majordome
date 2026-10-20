import { NextResponse } from "next/server";
import { denied } from "@/lib/access";
import { toSpokenText } from "@/lib/speech-text";
import { supabaseAdmin } from "@/lib/supabase";
import { parisDay, parisIso } from "@/lib/task-groups";
import { decideSpeak, EL_MODELS, elevenCostUsd, isElModel, maxCharsPerDay, ttsCostUsd, unit01, type ElModel } from "@/lib/voice-budget";

export const maxDuration = 30;

// Voix cloud. Ordre : ElevenLabs (si ELEVENLABS_API_KEY et ELEVENLABS_VOICE_ID sont définies) → OpenAI gpt-4o-mini-tts → { fallback: true } : l'écran lit alors avec la voix du téléphone, sans message d'erreur.
// Protégée par le code d'accès. Le texte est nettoyé ici (balise d'humeur, markdown, emojis, chiffres et heures en toutes lettres) : voir src/lib/speech-text.ts.
// Plafond de caractères par jour (VOICE_MAX_CHARS_PER_DAY) commun aux deux services ; chaque génération réussie est journalisée dans ai_calls (purpose « tts », input_tokens = caractères).

const OPENAI_MODEL = "gpt-4o-mini-tts";
const VOICES = ["coral", "sage", "verse", "ash", "nova"] as const;
type Voice = (typeof VOICES)[number];

// Consigne de ton OpenAI : la voix doit sonner comme un ami organisé, pas comme un GPS.
const TONE =
  "Parle en français de France, comme un grand majordome britannique : voix posée, chaleureuse et distinguée, vouvoiement, une pointe d'humour pince-sans-rire. Rythme naturel avec de légères variations d'intonation et de vraies pauses entre les phrases ; jamais robotique, jamais monotone, jamais théâtral. Prononce les heures et les nombres naturellement.";

// Petites phrases répétées (« Ok, c'est fait. ») : gardées en mémoire de l'instance, pas refacturées.
const cache = new Map<string, { audio: ArrayBuffer; provider: string }>();
const CACHE_MAX = 100;
const CACHE_MAX_CHARS = 80;

async function usedToday(): Promise<number> {
  const r = await supabaseAdmin().from("ai_calls").select("input_tokens").eq("purpose", "tts").gte("created_at", parisIso(parisDay(new Date()), 0, 0)).limit(5000);
  if (r.error) return 0; // table absente ou illisible : on ne bloque pas la voix pour ça
  return (r.data ?? []).reduce((s, x) => s + (x.input_tokens ?? 0), 0);
}

type Attempt = { provider: "elevenlabs" | "openai"; model: string; costUsd: number; call: () => Promise<Response> };

export async function POST(req: Request) {
  if (denied(req)) return NextResponse.json({ error: "Accès refusé" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { text?: unknown; voice?: unknown; nocache?: unknown; model?: unknown; stability?: unknown; style?: unknown; only?: unknown };
  const spoken = typeof body.text === "string" ? toSpokenText(body.text.slice(0, 4000)) : "";
  const voice: Voice = (VOICES as readonly string[]).includes(body.voice as string) ? (body.voice as Voice) : "coral";
  const elKey = process.env.ELEVENLABS_API_KEY;
  const elVoice = process.env.ELEVENLABS_VOICE_ID;
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!(elKey && elVoice) && !openaiKey) return NextResponse.json({ fallback: true, reason: "no-key" }, { status: 501 });
  if (!spoken) return new NextResponse(null, { status: 204 });

  // Modèle ElevenLabs : celui demandé par l'écran, sinon ELEVENLABS_MODEL (flash / v2 / v3), sinon Flash (le plus rapide et le moins cher).
  const envModel = process.env.ELEVENLABS_MODEL;
  const model: ElModel = isElModel(body.model) ? body.model : isElModel(envModel) ? envModel : "flash";
  const stability = unit01(body.stability, 0.5);
  const style = unit01(body.style, 0);

  const attempts: Attempt[] = [];
  if (elKey && elVoice && body.only !== "openai") { // « only » : la page /voix-test écoute OpenAI seule
    const m = EL_MODELS[model];
    attempts.push({
      provider: "elevenlabs",
      model: m.id,
      costUsd: elevenCostUsd(spoken.length, model),
      call: () =>
        fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(elVoice)}${m.stream ? "/stream" : ""}?output_format=mp3_44100_128`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "xi-api-key": elKey },
          body: JSON.stringify({ text: spoken, model_id: m.id, ...(m.lang ? { language_code: "fr" } : {}), voice_settings: { stability, similarity_boost: 0.75, style } }),
        }),
    });
  }
  if (openaiKey) {
    attempts.push({ // repli n° 1 si ElevenLabs est absent ou en panne
      provider: "openai",
      model: OPENAI_MODEL,
      costUsd: ttsCostUsd(spoken.length),
      call: () =>
        fetch("https://api.openai.com/v1/audio/speech", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
          body: JSON.stringify({ model: OPENAI_MODEL, voice, input: spoken, instructions: TONE, response_format: "mp3" }),
        }),
    });
  }

  if (!attempts.length) return NextResponse.json({ fallback: true, reason: "no-key" }, { status: 501 });
  const used = await usedToday();
  const headers = (extra: Record<string, string> = {}) => ({
    "Content-Type": "audio/mpeg",
    "Cache-Control": "no-store",
    "x-chars": String(spoken.length),
    "x-used-today": String(used),
    "x-max-per-day": String(maxCharsPerDay()),
    "x-spoken": encodeURIComponent(spoken.slice(0, 600)),
    ...extra,
  });

  const cacheKey = `${attempts[0].provider}|${attempts[0].model}|${voice}|${stability}|${style}|${spoken}`;
  const hit = body.nocache === true ? undefined : cache.get(cacheKey);
  if (hit) return new NextResponse(hit.audio, { headers: headers({ "x-cache": "hit", "x-cost-usd": "0", "x-provider": hit.provider }) });

  const decision = decideSpeak({ enabled: true, usedToday: used, chars: spoken.length, maxPerDay: maxCharsPerDay() });
  if (decision.mode === "phone") return NextResponse.json({ fallback: true, reason: decision.reason }, { status: 429 }); // plafond : l'écran se replie en silence

  let failedFirst = "";
  for (const a of attempts) {
    const t0 = Date.now();
    let upstream: Response | null = null;
    try {
      upstream = await a.call();
    } catch {
      /* réseau : on passe au suivant */
    }
    if (!upstream?.ok || !upstream.body) {
      console.error(`TTS ${a.provider} :`, upstream?.status ?? "réseau"); // jamais la clé ni le texte dans les logs
      failedFirst ||= a.provider;
      continue;
    }

    // Journalisation : une ligne par génération (comme tous les appels IA).
    const log = () =>
      void supabaseAdmin().from("ai_calls").insert({ model: `${a.provider}/${a.model}`, purpose: "tts", input_tokens: spoken.length, output_tokens: 0, cost_usd: a.costUsd, duration_ms: Date.now() - t0 }).then(({ error }) => {
        if (error) console.error("Journalisation ai_calls (tts) échouée :", error.message);
      });
    const meta = { "x-provider": a.provider, "x-model": a.model, "x-cost-usd": a.costUsd.toFixed(5), "x-cache": "miss", ...(failedFirst ? { "x-fallback-from": failedFirst } : {}) };

    if (spoken.length <= CACHE_MAX_CHARS) {
      const audio = await upstream.arrayBuffer();
      if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
      if (body.nocache !== true && !failedFirst) cache.set(cacheKey, { audio, provider: a.provider }); // un repli n'est pas gardé : le prochain essai retente la voix principale
      log();
      return new NextResponse(audio, { headers: headers(meta) });
    }
    log();
    return new NextResponse(upstream.body, { headers: headers(meta) }); // longue phrase : l'audio part dès que le début arrive
  }
  return NextResponse.json({ fallback: true, reason: "service" }, { status: 502 }); // tous les services en panne : voix du téléphone
}
