"use client";

import { useEffect, useImperativeHandle, useRef, useState } from "react";
import Markdown from "react-markdown";
import Orb, { orbLabel, type OrbState } from "./orb";
import { greeting, Wordmark } from "./ui";

type Message = { role: "user" | "assistant"; content: string };
export type ChatHandle = { listen: () => void; focusInput: () => void; newConversation: () => void };

const CLEARED_KEY = "majordome-cleared-at";

const SUGGESTIONS = [
  "Qu'est-ce que j'ai à faire aujourd'hui ?",
  "Ajoute une tâche : ",
  "Aide-moi à planifier ma semaine",
  "Que sais-tu de mes objectifs ?",
];

// API de dictée du navigateur (Chrome Android : webkitSpeechRecognition). Pas de types officiels.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const speechRecognition = (): any => (typeof window === "undefined" ? null : (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition ?? null);

/** Texte lisible à voix haute : on retire la mise en forme markdown. */
const plain = (md: string) =>
  md
    .replace(/[*_`#>]+/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/⚠️/g, "");

export default function ChatView({
  ref,
  accessCode,
  open,
  speak,
  onClose,
  onUnauthorized,
  onState,
}: {
  ref: React.Ref<ChatHandle>;
  accessCode: string;
  open: boolean;
  speak: boolean; // lire les réponses à voix haute quand on a parlé
  onClose: () => void;
  onUnauthorized: () => void;
  onState: (s: OrbState) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [waiting, setWaiting] = useState(false); // en attente du premier mot
  const [busy, setBusy] = useState(false); // réponse en cours
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [interim, setInterim] = useState(""); // ce que la dictée entend en direct
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null);

  const state: OrbState = listening ? "listening" : waiting ? "thinking" : busy || speaking ? "speaking" : "idle";
  useEffect(() => onState(state), [state, onState]);

  // Historique : on recharge les derniers messages (après la dernière « Nouvelle conversation »).
  useEffect(() => {
    let clearedAt: string | null = null;
    try {
      clearedAt = localStorage.getItem(CLEARED_KEY);
    } catch {
      /* ignore */
    }
    fetch(`/api/messages${clearedAt ? `?after=${encodeURIComponent(clearedAt)}` : ""}`, { headers: { "x-access-code": accessCode } })
      .then((r) => (r.ok ? r.json() : { messages: [] }))
      .then((d) => setMessages((cur) => (cur.length ? cur : d.messages.map((m: Message) => ({ role: m.role, content: m.content })))))
      .catch(() => {});
  }, [accessCode]);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, waiting, interim, open]);

  // Fermer le chat coupe la voix et la dictée.
  useEffect(() => {
    if (!open) {
      recRef.current?.abort();
      window.speechSynthesis?.cancel();
    }
  }, [open]);

  function say(text: string) {
    const synth = window.speechSynthesis;
    if (!synth || !text.trim()) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(plain(text));
    u.lang = "fr-FR";
    const voices = synth.getVoices();
    u.voice = voices.find((v) => v.lang === "fr-FR" && /google|natural|premium/i.test(v.name)) ?? voices.find((v) => v.lang.startsWith("fr")) ?? null;
    u.onstart = () => setSpeaking(true);
    u.onend = u.onerror = () => setSpeaking(false);
    synth.speak(u);
  }

  async function send(raw = input, viaVoice = false) {
    const text = raw.trim();
    if (!text || busy) return;
    const next: Message[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setWaiting(true);
    setBusy(true);
    setError(null);
    let reply = "";
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-access-code": accessCode },
        body: JSON.stringify({ messages: next }),
      });
      if (res.status === 401) return onUnauthorized();
      if (!res.ok || !res.body) throw new Error((await res.json().catch(() => ({}))).error ?? "Erreur inconnue");
      // Lecture du flux : la réponse de Majordome se remplit au fil de l'eau.
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        reply += value;
        setWaiting(false);
        setMessages([...next, { role: "assistant", content: reply }]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setWaiting(false);
      setBusy(false);
    }
    if (viaVoice && speak) say(reply);
  }

  // Dictée : appelée directement dans le clic (le navigateur exige un geste de l'utilisateur).
  function listen() {
    const SR = speechRecognition();
    if (!SR) {
      setError("La dictée n'est pas disponible sur ce navigateur : écris ton message.");
      inputRef.current?.focus();
      return;
    }
    if (listening) return recRef.current?.stop();
    window.speechSynthesis?.cancel();
    const rec = new SR();
    rec.lang = "fr-FR";
    rec.interimResults = true;
    rec.continuous = false;
    let heard = "";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      heard = Array.from(e.results as ArrayLike<{ 0: { transcript: string } }>)
        .map((r) => r[0].transcript)
        .join("");
      setInterim(heard);
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onerror = (e: any) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") setError("Micro refusé. Autorise-le dans les réglages du navigateur, ou écris ton message.");
      else if (e.error !== "no-speech" && e.error !== "aborted") setError(`Dictée interrompue (${e.error}).`);
    };
    rec.onend = () => {
      setListening(false);
      setInterim("");
      recRef.current = null;
      if (heard.trim()) send(heard, true);
    };
    recRef.current = rec;
    setError(null);
    setListening(true);
    rec.start();
  }

  function newConversation() {
    setMessages([]);
    setError(null);
    try {
      localStorage.setItem(CLEARED_KEY, new Date().toISOString());
    } catch {
      /* ignore */
    }
  }

  useImperativeHandle(ref, () => ({ listen, focusInput: () => setTimeout(() => inputRef.current?.focus(), 50), newConversation }));

  // Une suggestion qui finit par un espace (« Ajoute une tâche : ») est à compléter : on la met dans le champ.
  function suggest(s: string) {
    if (s.endsWith(" ")) {
      setInput(s);
      inputRef.current?.focus();
    } else send(s);
  }

  const empty = messages.length === 0 && !waiting && !listening;

  return (
    <section
      className={`${open ? "flex" : "hidden"} sheet-up fixed inset-0 z-40 mx-auto max-w-2xl flex-col bg-ink pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]`}
      aria-label="Conversation avec Majordome"
      role="dialog"
    >
      <header className="flex h-16 items-center gap-3 px-3">
        <button onClick={onClose} aria-label="Fermer la conversation" className="flex size-11 items-center justify-center rounded-full text-muted active:bg-raised">
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        <Orb state={state} size={30} />
        <div className="min-w-0 flex-1">
          <Wordmark className="text-[17px] leading-none" />
          <p className="mt-1 text-xs text-faint">{state === "idle" ? "À ton service" : orbLabel(state)}</p>
        </div>
        {messages.length > 0 && (
          <button onClick={newConversation} className="min-h-11 px-2 text-xs text-faint active:text-fg">
            Nouvelle conversation
          </button>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
        {empty && (
          <div className="flex min-h-full flex-col justify-end gap-2">
            <p className="mb-4 text-[24px] font-semibold leading-snug tracking-tight">{greeting()} Ruben.<br />Qu&apos;est-ce que je peux faire pour toi ?</p>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => suggest(s)}
                className="min-h-12 rounded-2xl bg-surface px-4 py-3 text-left text-[15px] text-muted transition-colors active:bg-raised active:text-fg"
              >
                {s.trim()}
              </button>
            ))}
          </div>
        )}

        <div className="space-y-4 empty:hidden">
          {messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="rise ml-auto w-fit max-w-[85%] whitespace-pre-wrap rounded-3xl rounded-br-lg bg-raised px-4 py-2.5 text-[15px] leading-relaxed">
                {m.content}
              </div>
            ) : (
              <div key={i} className="rise md max-w-[94%] text-[15.5px] leading-relaxed text-fg/95">
                <Markdown>{m.content}</Markdown>
              </div>
            ),
          )}
          {listening && (
            <div className="flex flex-col items-center gap-5 py-10" aria-live="polite">
              <Orb state="listening" size={96} />
              <p className="min-h-6 text-center text-lg font-medium text-fg/90">{interim || "Je t'écoute…"}</p>
            </div>
          )}
          {waiting && (
            <p className="flex items-center gap-2 text-sm text-faint" aria-live="polite">
              Majordome écrit
              <span className="dots flex gap-0.5" aria-hidden>
                <span>·</span>
                <span>·</span>
                <span>·</span>
              </span>
            </p>
          )}
          {error && <p className="text-sm text-neg">{error}</p>}
        </div>
        <div ref={bottomRef} />
      </div>

      <footer className="flex items-end gap-2 px-3 pb-3 pt-2">
        <div className="flex min-h-12 flex-1 items-end rounded-3xl bg-surface pl-4 pr-1 focus-within:ring-1 focus-within:ring-accent/50">
          <textarea
            ref={inputRef}
            value={input}
            rows={1}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Écrire à Majordome…"
            aria-label="Message"
            className="max-h-40 min-h-12 flex-1 resize-none bg-transparent py-3 text-[15px] leading-snug outline-none [field-sizing:content] placeholder:text-faint"
          />
          {!input.trim() && (
            <button onClick={listen} aria-label={listening ? "Arrêter la dictée" : "Dicter"} className={`flex size-11 shrink-0 items-center justify-center rounded-full ${listening ? "text-accent" : "text-muted"}`}>
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                <rect x="9" y="3" width="6" height="12" rx="3" />
                <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
              </svg>
            </button>
          )}
        </div>
        <button
          onClick={() => send()}
          disabled={busy || !input.trim()}
          aria-label="Envoyer"
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent text-ink transition-opacity disabled:opacity-25"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </button>
      </footer>
    </section>
  );
}
