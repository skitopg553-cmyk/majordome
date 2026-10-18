"use client";

import { useEffect, useRef, useState } from "react";
import { ttsCostUsd } from "@/lib/voice-budget";

// Page de comparaison des voix : la même phrase lue par plusieurs voix, avec le délai avant le premier son (mesuré) et le coût estimé.
// Protégée par le code d'accès (le même que l'app, lu dans ce navigateur). Rien n'est branché dans l'app tant que Ruben n'a pas choisi.

const PHRASES = [
  { id: "courte", label: "Courte", text: "Ok, c'est fait." },
  { id: "chiffres", label: "Chiffres", text: "Réveil réglé à sept heures trente. Tu as 3 tâches aujourd'hui, dont deux avant midi." },
  { id: "longue", label: "Longue", text: "Bonne nouvelle, ta semaine est bien partie. Tu as fait quatre séances de sport et dépensé moins que d'habitude. Pour demain, je te conseille de décaler le rendez-vous de quatorze heures." },
];

type Row = { id: string; label: string; note: string; voice?: string };
const ROWS: Row[] = [
  { id: "phone", label: "Voix du téléphone (celle d'aujourd'hui)", note: "Gratuite, point de comparaison." },
  { id: "openai-coral", label: "OpenAI · coral", note: "gpt-4o-mini-tts, consigne de ton chaleureux.", voice: "coral" },
  { id: "openai-sage", label: "OpenAI · sage", note: "Plus posée, plus calme.", voice: "sage" },
  { id: "openai-verse", label: "OpenAI · verse", note: "Plus expressive.", voice: "verse" },
  { id: "openai-ash", label: "OpenAI · ash", note: "Voix plus grave.", voice: "ash" },
];

type Result = { reply?: number; sound?: number; cost?: number; chars?: number; spoken?: string; error?: string; cache?: string; used?: string; max?: string };
const ms = (n?: number) => (n === undefined ? "—" : `${Math.round(n)} ms`);
const usd = (n?: number) => (n === undefined ? "—" : n === 0 ? "gratuit" : `≈ ${n.toFixed(4).replace(".", ",")} $`);

export default function VoixTest() {
  const [code, setCode] = useState<string | null>(null);
  const [phrase, setPhrase] = useState(PHRASES[1]);
  const [results, setResults] = useState<Record<string, Result>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    try {
      setCode(localStorage.getItem("majordome-access-code") ?? "");
    } catch {
      setCode("");
    }
  }, []);

  const set = (id: string, r: Result) => setResults((cur) => ({ ...cur, [id]: { ...cur[id], ...r } }));

  function stop() {
    audio.current?.pause();
    window.speechSynthesis?.cancel();
  }

  async function play(row: Row) {
    stop();
    setBusy(row.id);
    set(row.id, { reply: undefined, sound: undefined, error: undefined, cache: undefined });
    const t0 = performance.now();
    try {
      if (row.id === "phone") {
        const synth = window.speechSynthesis;
        if (!synth) throw new Error("Pas de synthèse vocale sur ce navigateur");
        const u = new SpeechSynthesisUtterance(phrase.text);
        u.lang = "fr-FR";
        const fr = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith("fr"));
        if (fr) u.voice = fr;
        u.onstart = () => set(row.id, { sound: performance.now() - t0, cost: 0, chars: phrase.text.length });
        u.onend = () => setBusy(null);
        u.onerror = () => setBusy(null);
        synth.speak(u);
        return;
      }
      const res = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json", "x-access-code": code ?? "" }, body: JSON.stringify({ text: phrase.text, voice: row.voice, nocache: true }) });
      const reply = performance.now() - t0; // l'audio commence d'arriver
      if (res.status === 401) throw new Error("Code d'accès refusé : ouvre l'app et entre ton code.");
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.reason === "cap" ? "Plafond du jour atteint (repli sur la voix du téléphone)." : d.reason === "no-key" ? "Pas de clé OpenAI sur le serveur." : "Le service de voix ne répond pas (repli téléphone).");
      }
      const blob = await res.blob();
      const chars = Number(res.headers.get("x-chars") ?? 0);
      set(row.id, { reply, chars, cost: Number(res.headers.get("x-cost-usd") ?? ttsCostUsd(chars)), spoken: decodeURIComponent(res.headers.get("x-spoken") ?? ""), used: res.headers.get("x-used-today") ?? undefined, max: res.headers.get("x-max-per-day") ?? undefined });
      const a = new Audio(URL.createObjectURL(blob));
      audio.current = a;
      a.onplaying = () => set(row.id, { sound: performance.now() - t0 });
      a.onended = () => setBusy(null);
      await a.play();
    } catch (e) {
      set(row.id, { error: e instanceof Error ? e.message : "Erreur" });
      setBusy(null);
    }
  }

  if (code === null) return null;
  if (!code) {
    return (
      <main className="mx-auto max-w-xl px-5 py-10">
        <h1 className="text-2xl font-semibold">Comparaison des voix</h1>
        <p className="mt-3 text-muted">Cette page est protégée. Ouvre d&apos;abord l&apos;app, entre ton code d&apos;accès, puis reviens ici (même navigateur).</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl space-y-4 px-5 pb-16 pt-8">
      <h1 className="text-2xl font-semibold tracking-tight">Comparaison des voix</h1>
      <p className="text-[14px] leading-snug text-muted">Écoute la même phrase avec chaque voix. « Premier son » = temps entre ton tap et le début du son : c&apos;est ce que tu ressentiras. Casque ou haut-parleur, au calme.</p>

      <div className="flex gap-2" role="tablist" aria-label="Phrase de test">
        {PHRASES.map((p) => (
          <button key={p.id} role="tab" aria-selected={phrase.id === p.id} onClick={() => { stop(); setBusy(null); setPhrase(p); }} className={`min-h-11 flex-1 rounded-full text-[14px] font-medium ${phrase.id === p.id ? "bg-raised text-fg" : "bg-surface text-muted"}`}>
            {p.label}
          </button>
        ))}
      </div>
      <p className="rounded-2xl bg-surface p-4 text-[15px] leading-snug">« {phrase.text} »</p>

      <ul className="space-y-3">
        {ROWS.map((row) => {
          const r = results[row.id] ?? {};
          return (
            <li key={row.id} className="rounded-[22px] bg-surface p-4">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-medium">{row.label}</p>
                  <p className="text-[13px] text-muted">{row.note}</p>
                </div>
                <button onClick={() => (busy === row.id ? (stop(), setBusy(null)) : void play(row))} className="min-h-11 shrink-0 rounded-full bg-accent px-5 text-[14px] font-semibold text-ink active:scale-95">
                  {busy === row.id ? "Stop" : "Lecture"}
                </button>
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-[12px]">
                <div><dt className="text-faint">Réponse reçue</dt><dd className="tabular-nums text-fg">{row.id === "phone" ? "—" : ms(r.reply)}</dd></div>
                <div><dt className="text-faint">Premier son</dt><dd className="tabular-nums text-fg">{ms(r.sound)}</dd></div>
                <div><dt className="text-faint">Coût de la phrase</dt><dd className="tabular-nums text-fg">{usd(r.cost)}</dd></div>
              </dl>
              {r.spoken && <p className="mt-2 text-[12px] text-faint">Texte réellement lu : {r.spoken}</p>}
              {r.error && <p className="mt-2 text-[13px] text-neg">{r.error}</p>}
            </li>
          );
        })}

        <li className="rounded-[22px] bg-surface p-4 opacity-80">
          <p className="text-[15px] font-medium">Google / Gemini (voix)</p>
          <p className="mt-1 text-[13px] text-muted">Pas de clé dans l&apos;environnement : non branchée. Pour l&apos;ajouter : crée une clé sur aistudio.google.com/apikey, puis ajoute la variable <code>GEMINI_API_KEY</code> dans Vercel (je ne la vois jamais).</p>
        </li>
        <li className="rounded-[22px] bg-surface p-4 opacity-80">
          <p className="text-[15px] font-medium">ElevenLabs</p>
          <p className="mt-1 text-[13px] text-muted">Seulement si tu me donnes une clé : crée un compte sur elevenlabs.io, puis Profil → API Keys → Create, et ajoute <code>ELEVENLABS_API_KEY</code> dans Vercel. Les voix y sont souvent les plus naturelles, mais le prix est plus élevé.</p>
        </li>
      </ul>

      {Object.values(results).find((r) => r.used) && (
        <p className="text-[12px] text-faint">
          Caractères lus aujourd&apos;hui (avant cette phrase) : {Object.values(results).find((r) => r.used)?.used} sur {Object.values(results).find((r) => r.max)?.max} autorisés par jour.
        </p>
      )}
    </main>
  );
}
