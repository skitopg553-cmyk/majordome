"use client";

import { useEffect, useRef, useState } from "react";

// Prototype « conversation » : le modèle audio temps réel d'OpenAI parle DIRECTEMENT (sans texte lu), en « maintenir pour parler ».
// Réservé à cette page. Le serveur donne un jeton temporaire (/api/realtime) : la clé OpenAI ne vient jamais ici. Plafond de minutes par jour côté serveur ET décompte ici.
// Pas d'interruption en temps réel : on relâche le bouton, le modèle répond. Rien n'est branché dans le reste de l'app.

type Phase = "off" | "connecting" | "ready" | "listening" | "thinking" | "speaking";
type Line = { who: "vous" | "majordome"; text: string };

const LABEL: Record<Phase, string> = { off: "Conversation fermée", connecting: "Connexion…", ready: "Prêt : maintenez le bouton pour parler", listening: "Je vous écoute…", thinking: "Je réfléchis…", speaking: "Majordome parle" };
const mmss = (s: number) => `${Math.floor(s / 60)} min ${String(Math.floor(s % 60)).padStart(2, "0")} s`;

export default function ConversationProto({ accessCode }: { accessCode: string }) {
  const [phase, setPhase] = useState<Phase>("off");
  const [error, setError] = useState<string | null>(null);
  const [allowed, setAllowed] = useState<number | null>(null); // secondes autorisées au départ de cette session
  const [elapsed, setElapsed] = useState(0);
  const [perMinute, setPerMinute] = useState(0.2);
  const [model, setModel] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [latency, setLatency] = useState<number | undefined>();

  const pc = useRef<RTCPeerConnection | null>(null);
  const dc = useRef<RTCDataChannel | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const track = useRef<MediaStreamTrack | null>(null);
  const sessionId = useRef<number | null>(null);
  const startedAt = useRef(0);
  const releasedAt = useRef(0);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef = useRef<Phase>("off");
  const go = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  const headers = { "Content-Type": "application/json", "x-access-code": accessCode };

  function onEvent(raw: MessageEvent<string>) {
    let e: { type?: string; transcript?: string; error?: { message?: string } };
    try {
      e = JSON.parse(raw.data);
    } catch {
      return;
    }
    if (e.type === "conversation.item.input_audio_transcription.completed" && e.transcript?.trim()) setLines((l) => [...l, { who: "vous", text: e.transcript!.trim() }]);
    else if (e.type === "output_audio_buffer.started") {
      setLatency(performance.now() - releasedAt.current); // du relâchement du bouton au premier son
      go("speaking");
    } else if (e.type === "response.output_audio_transcript.done" && e.transcript?.trim()) setLines((l) => [...l, { who: "majordome", text: e.transcript!.trim() }]);
    else if (e.type === "output_audio_buffer.stopped" && phaseRef.current === "speaking") go("ready");
    else if (e.type === "error") setError(e.error?.message ?? "Erreur du service de conversation");
  }

  async function stop() {
    if (tick.current) clearInterval(tick.current);
    tick.current = null;
    dc.current?.close();
    pc.current?.close();
    stream.current?.getTracks().forEach((t) => t.stop());
    if (audio.current) audio.current.srcObject = null;
    pc.current = dc.current = stream.current = track.current = null;
    const seconds = startedAt.current ? (performance.now() - startedAt.current) / 1000 : 0;
    startedAt.current = 0;
    if (sessionId.current) {
      // Journalise la durée et le coût estimé dans ai_calls (côté serveur).
      await fetch("/api/realtime", { method: "POST", headers, body: JSON.stringify({ action: "end", sessionId: sessionId.current, seconds }) }).catch(() => {});
      sessionId.current = null;
    }
    go("off");
  }

  async function start() {
    setError(null);
    setLines([]);
    setLatency(undefined);
    setElapsed(0);
    go("connecting");
    try {
      const r = await fetch("/api/realtime", { method: "POST", headers, body: JSON.stringify({ action: "start" }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? `Erreur ${r.status}`);
      sessionId.current = j.sessionId ?? null;
      setAllowed(j.remainingSeconds);
      setPerMinute(j.usdPerMinute);
      setModel(j.model);

      const peer = new RTCPeerConnection();
      pc.current = peer;
      const el = (audio.current ??= new Audio());
      el.autoplay = true;
      peer.ontrack = (ev) => {
        el.srcObject = ev.streams[0];
      };
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = mic;
      const t = mic.getAudioTracks()[0];
      t.enabled = false; // le micro ne s'ouvre que pendant que le bouton est maintenu
      track.current = t;
      peer.addTrack(t, mic);
      const channel = peer.createDataChannel("oai-events");
      dc.current = channel;
      channel.onmessage = onEvent;

      await peer.setLocalDescription(await peer.createOffer());
      const answer = await fetch("https://api.openai.com/v1/realtime/calls", { method: "POST", body: peer.localDescription!.sdp, headers: { Authorization: `Bearer ${j.secret}`, "Content-Type": "application/sdp" } });
      if (!answer.ok) throw new Error(`OpenAI a refusé la connexion (${answer.status}).`);
      await peer.setRemoteDescription({ type: "answer", sdp: await answer.text() });

      startedAt.current = performance.now();
      tick.current = setInterval(() => {
        const s = (performance.now() - startedAt.current) / 1000;
        setElapsed(s);
        if (s >= j.remainingSeconds) void stop(); // plafond du jour atteint : la session se ferme toute seule
      }, 500);
      go("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connexion impossible");
      await stop();
    }
  }

  // Maintenir pour parler : le micro s'ouvre ; au relâchement, la phrase est validée et le modèle répond. Appuyer pendant qu'il parle le coupe.
  function press() {
    if (phaseRef.current !== "ready" && phaseRef.current !== "speaking") return;
    if (phaseRef.current === "speaking") {
      dc.current?.send(JSON.stringify({ type: "response.cancel" }));
      dc.current?.send(JSON.stringify({ type: "output_audio_buffer.clear" }));
    }
    if (track.current) track.current.enabled = true;
    go("listening");
  }
  function release() {
    if (phaseRef.current !== "listening") return;
    if (track.current) track.current.enabled = false;
    releasedAt.current = performance.now();
    dc.current?.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
    dc.current?.send(JSON.stringify({ type: "response.create" }));
    go("thinking");
  }

  useEffect(() => () => void stop(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const on = phase !== "off";
  const left = allowed === null ? null : Math.max(0, allowed - elapsed);
  return (
    <section className="rounded-[22px] bg-surface p-4" aria-label="Conversation, prototype">
      <p className="text-[15px] font-medium">Conversation · prototype</p>
      <p className="mt-1 text-[13px] leading-snug text-muted">
        Le modèle audio d&apos;OpenAI répond directement de vive voix (pas de texte lu), avec la personnalité du majordome. Maintenez le bouton pour parler, relâchez pour qu&apos;il réponde. Il n&apos;a pas accès à vos données. Les minutes sont plafonnées chaque jour et chaque session est journalisée.
      </p>

      {!on ? (
        <button onClick={() => void start()} className="mt-3 min-h-11 rounded-full bg-accent px-5 text-[14px] font-semibold text-ink active:scale-95">
          Démarrer la conversation
        </button>
      ) : (
        <>
          <p className="mt-3 text-[14px] text-fg" aria-live="polite">{LABEL[phase]}</p>
          <button
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              press();
            }}
            onPointerUp={release}
            onPointerCancel={release}
            onContextMenu={(e) => e.preventDefault()}
            disabled={phase === "connecting"}
            className={`mt-2 min-h-16 w-full touch-none select-none rounded-full text-[15px] font-semibold transition-colors ${phase === "listening" ? "bg-accent text-ink" : "bg-raised text-fg ring-1 ring-line"} disabled:opacity-50`}
          >
            {phase === "listening" ? "Relâchez pour envoyer" : "Maintenir pour parler"}
          </button>
          <button onClick={() => void stop()} className="mt-2 min-h-11 rounded-full px-4 text-[13px] font-medium text-muted active:bg-raised">
            Terminer la conversation
          </button>
          <dl className="mt-2 grid grid-cols-3 gap-2 text-[12px]">
            <div><dt className="text-faint">Reste aujourd&apos;hui</dt><dd className="tabular-nums text-fg">{left === null ? "—" : mmss(left)}</dd></div>
            <div><dt className="text-faint">Session · coût estimé</dt><dd className="tabular-nums text-fg">{mmss(elapsed)} · ≈ {((elapsed / 60) * perMinute).toFixed(3).replace(".", ",")} $</dd></div>
            <div><dt className="text-faint">Délai de réponse</dt><dd className="tabular-nums text-fg">{latency === undefined ? "—" : `${Math.round(latency)} ms`}</dd></div>
          </dl>
        </>
      )}
      {model && <p className="mt-1 text-[12px] text-faint">Modèle : {model} · estimation {perMinute.toFixed(2).replace(".", ",")} $ la minute (à comparer à votre facture OpenAI).</p>}
      {error && <p className="mt-2 text-[13px] text-neg">{error}</p>}
      {lines.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-line pt-3 text-[13px]">
          {lines.slice(-6).map((l, i) => (
            <li key={i} className={l.who === "vous" ? "text-muted" : "text-fg"}>
              <span className="text-faint">{l.who === "vous" ? "Vous : " : "Majordome : "}</span>
              {l.text}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
