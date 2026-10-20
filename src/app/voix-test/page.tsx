"use client";

import { useEffect, useRef, useState } from "react";

// Page de comparaison des voix : les 3 phrases lues par chaque modèle ElevenLabs (Flash, Multilingual v2, v3), avec le délai avant le premier son (mesuré) et le coût.
// Curseurs de stabilité et de style, envoyés au serveur à chaque lecture. Protégée par le code d'accès (le même que l'app, lu dans ce navigateur).
// Rien n'est branché dans le reste de l'app tant que Ruben n'a pas choisi.

const PHRASES = [
  { id: "courte", label: "Courte", text: "Très bien, Monsieur. C'est noté." },
  { id: "chiffres", label: "Chiffres", text: "Réveil réglé à sept heures trente, Monsieur. Vous avez 3 tâches aujourd'hui, dont deux avant midi." },
  { id: "longue", label: "Longue", text: "Bonne nouvelle, Monsieur : votre semaine est bien partie. Vous avez fait quatre séances de sport et dépensé moins que d'habitude. Pour demain, je vous conseille de décaler le rendez-vous de quatorze heures." },
];

type Row = { id: string; label: string; note: string; model?: "flash" | "v2" | "v3"; openai?: boolean };
const ROWS: Row[] = [
  { id: "phone", label: "Voix du téléphone", note: "Gratuite, dernier repli et point de comparaison." },
  { id: "flash", label: "ElevenLabs · Flash v2.5", note: "Le plus rapide et le moins cher (0,5 crédit par caractère).", model: "flash" },
  { id: "v2", label: "ElevenLabs · Multilingual v2", note: "Plus riche, plus lent (1 crédit par caractère).", model: "v2" },
  { id: "v3", label: "ElevenLabs · v3", note: "Le plus expressif ; l'audio arrive d'un bloc, donc plus lent (1 crédit par caractère). Stabilité : 0 = créatif, 0,5 = naturel, 1 = stable.", model: "v3" },
  { id: "openai", label: "OpenAI · coral (repli n° 1)", note: "gpt-4o-mini-tts : utilisé si ElevenLabs tombe.", openai: true },
];

type Result = { reply?: number; sound?: number; cost?: number; chars?: number; spoken?: string; error?: string; provider?: string; used?: string; max?: string };
const ms = (n?: number) => (n === undefined ? "—" : `${Math.round(n)} ms`);
const usd = (n?: number) => (n === undefined ? "—" : n === 0 ? "gratuit" : `≈ ${n.toFixed(4).replace(".", ",")} $`);
const fmt = (n: number) => n.toFixed(2).replace(".", ",");

export default function VoixTest() {
  const [code, setCode] = useState<string | null>(null);
  const [phrase, setPhrase] = useState(PHRASES[1]);
  const [stability, setStability] = useState(0.5);
  const [style, setStyle] = useState(0);
  const [results, setResults] = useState<Record<string, Result>>({}); // clé : « ligne|phrase »
  const [busy, setBusy] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const stopped = useRef(false);

  useEffect(() => {
    try {
      setCode(localStorage.getItem("majordome-access-code") ?? "");
    } catch {
      setCode("");
    }
  }, []);

  const set = (key: string, r: Result) => setResults((cur) => ({ ...cur, [key]: { ...cur[key], ...r } }));

  function stop() {
    stopped.current = true;
    audio.current?.pause();
    window.speechSynthesis?.cancel();
  }

  /** Lit une phrase avec une ligne ; la promesse se termine quand le son est fini (ou en erreur). */
  async function play(row: Row, p: (typeof PHRASES)[number]): Promise<void> {
    const key = `${row.id}|${p.id}`;
    set(key, { reply: undefined, sound: undefined, error: undefined, provider: undefined });
    const t0 = performance.now();
    try {
      if (row.id === "phone") {
        const synth = window.speechSynthesis;
        if (!synth) throw new Error("Pas de synthèse vocale sur ce navigateur");
        const u = new SpeechSynthesisUtterance(p.text);
        u.lang = "fr-FR";
        const fr = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith("fr"));
        if (fr) u.voice = fr;
        await new Promise<void>((done) => {
          u.onstart = () => set(key, { sound: performance.now() - t0, cost: 0, chars: p.text.length });
          u.onend = u.onerror = () => done();
          synth.speak(u);
        });
        return;
      }
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-access-code": code ?? "" },
        // Pour la ligne OpenAI on n'envoie pas de modèle ElevenLabs : sans clé ElevenLabs côté serveur elle passerait directement par OpenAI ; avec, il faut forcer le repli.
        body: JSON.stringify({ text: p.text, voice: "coral", nocache: true, model: row.model, stability, style, only: row.openai ? "openai" : undefined }),
      });
      const reply = performance.now() - t0; // l'audio commence d'arriver
      if (res.status === 401) throw new Error("Code d'accès refusé : ouvre l'app et entrez votre code.");
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.reason === "cap" ? "Plafond du jour atteint (repli sur la voix du téléphone)." : d.reason === "no-key" ? "Aucune clé de voix sur le serveur." : "Les services de voix ne répondent pas (repli téléphone).");
      }
      const blob = await res.blob();
      const provider = res.headers.get("x-provider") ?? undefined;
      const from = res.headers.get("x-fallback-from");
      set(key, {
        reply,
        chars: Number(res.headers.get("x-chars") ?? 0),
        cost: Number(res.headers.get("x-cost-usd") ?? 0),
        provider: from ? `${provider} (repli : ${from} en panne)` : provider,
        spoken: decodeURIComponent(res.headers.get("x-spoken") ?? ""),
        used: res.headers.get("x-used-today") ?? undefined,
        max: res.headers.get("x-max-per-day") ?? undefined,
      });
      const a = new Audio(URL.createObjectURL(blob));
      audio.current = a;
      a.onplaying = () => set(key, { sound: performance.now() - t0 });
      await new Promise<void>((done) => {
        a.onended = a.onerror = () => done();
        a.play().catch(() => done());
      });
    } catch (e) {
      set(key, { error: e instanceof Error ? e.message : "Erreur" });
    }
  }

  async function run(row: Row, list: (typeof PHRASES)[number][]) {
    stop();
    stopped.current = false;
    setBusy(row.id);
    for (const p of list) {
      if (stopped.current) break;
      await play(row, p);
    }
    setBusy(null);
  }

  if (code === null) return null;
  if (!code) {
    return (
      <main className="mx-auto max-w-xl px-5 py-10">
        <h1 className="text-2xl font-semibold">Comparaison des voix</h1>
        <p className="mt-3 text-muted">Cette page est protégée. Ouvrez d&apos;abord l&apos;app, entrez votre code d&apos;accès, puis revenez ici (même navigateur).</p>
      </main>
    );
  }

  const first = Object.values(results).find((r) => r.used);

  return (
    <main className="mx-auto max-w-xl space-y-4 px-5 pb-16 pt-8">
      <h1 className="text-2xl font-semibold tracking-tight">Comparaison des voix</h1>
      <p className="text-[14px] leading-snug text-muted">« Premier son » = temps entre votre tap et le début du son : c&apos;est ce que vous ressentirez. « Lecture » joue la phrase choisie ; « Les 3 phrases » les enchaîne. Casque ou haut-parleur, au calme.</p>

      <div className="space-y-3 rounded-[22px] bg-surface p-4">
        <label className="block text-[13px] text-muted">
          Stabilité : <span className="tabular-nums text-fg">{fmt(stability)}</span>
          <input type="range" min={0} max={1} step={0.05} value={stability} onChange={(e) => setStability(Number(e.target.value))} className="mt-1 block w-full accent-[var(--accent,#7c9cff)]" />
          <span className="text-[12px] text-faint">Bas = plus vivant mais plus variable ; haut = plus régulier, plus monotone.</span>
        </label>
        <label className="block text-[13px] text-muted">
          Style : <span className="tabular-nums text-fg">{fmt(style)}</span>
          <input type="range" min={0} max={1} step={0.05} value={style} onChange={(e) => setStyle(Number(e.target.value))} className="mt-1 block w-full accent-[var(--accent,#7c9cff)]" />
          <span className="text-[12px] text-faint">Exagère la personnalité de la voix. Au-dessus de 0 : un peu plus lent et plus cher en latence.</span>
        </label>
      </div>

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
          const r = results[`${row.id}|${phrase.id}`] ?? {};
          const on = busy === row.id;
          return (
            <li key={row.id} className="rounded-[22px] bg-surface p-4">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-medium">{row.label}</p>
                  <p className="text-[13px] text-muted">{row.note}</p>
                </div>
                <div className="flex shrink-0 flex-col gap-2">
                  <button onClick={() => (on ? (stop(), setBusy(null)) : void run(row, [phrase]))} className="min-h-11 rounded-full bg-accent px-5 text-[14px] font-semibold text-ink active:scale-95">
                    {on ? "Stop" : "Lecture"}
                  </button>
                  {!on && (
                    <button onClick={() => void run(row, PHRASES)} className="min-h-11 rounded-full bg-raised px-4 text-[13px] font-medium text-fg active:scale-95">
                      Les 3 phrases
                    </button>
                  )}
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-[12px]">
                <div><dt className="text-faint">Réponse reçue</dt><dd className="tabular-nums text-fg">{row.id === "phone" ? "—" : ms(r.reply)}</dd></div>
                <div><dt className="text-faint">Premier son</dt><dd className="tabular-nums text-fg">{ms(r.sound)}</dd></div>
                <div><dt className="text-faint">Coût de la phrase</dt><dd className="tabular-nums text-fg">{usd(r.cost)}</dd></div>
              </dl>
              {r.provider && <p className="mt-2 text-[12px] text-faint">Service qui a répondu : {r.provider}</p>}
              {r.spoken && <p className="mt-1 text-[12px] text-faint">Texte réellement lu : {r.spoken}</p>}
              {r.error && <p className="mt-2 text-[13px] text-neg">{r.error}</p>}
            </li>
          );
        })}
      </ul>

      <section className="rounded-[22px] bg-surface p-4">
        <h2 className="text-[15px] font-medium">Récapitulatif (premier son · coût)</h2>
        <table className="mt-2 w-full text-[12px]">
          <thead>
            <tr className="text-left text-faint">
              <th className="py-1 font-normal">Voix</th>
              {PHRASES.map((p) => <th key={p.id} className="py-1 font-normal">{p.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.id} className="border-t border-white/5 align-top">
                <td className="py-1.5 pr-2 text-muted">{row.label.replace("ElevenLabs · ", "")}</td>
                {PHRASES.map((p) => {
                  const r = results[`${row.id}|${p.id}`];
                  return <td key={p.id} className="py-1.5 tabular-nums text-fg">{r?.sound === undefined ? "—" : <>{ms(r.sound)}<br /><span className="text-faint">{usd(r.cost)}</span></>}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {first && (
        <p className="text-[12px] text-faint">
          Caractères lus aujourd&apos;hui (avant cette phrase) : {first.used} sur {first.max} autorisés par jour. Le coût ElevenLabs est une estimation (crédits × prix du crédit) : la vraie facture est sur elevenlabs.io.
        </p>
      )}
    </main>
  );
}
