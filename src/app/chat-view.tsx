"use client";

import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";

type Message = { role: "user" | "assistant"; content: string };

const CLEARED_KEY = "majordome-cleared-at";

const SUGGESTIONS = [
  "Qu'est-ce que j'ai à faire aujourd'hui ?",
  "Ajoute une tâche : ",
  "Aide-moi à planifier ma semaine",
  "Que sais-tu de mes objectifs ?",
];

export default function ChatView({ accessCode, hidden, onUnauthorized }: { accessCode: string; hidden: boolean; onUnauthorized: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [waiting, setWaiting] = useState(false); // en attente du premier mot
  const [busy, setBusy] = useState(false); // réponse en cours
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
    if (!hidden) bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, waiting, hidden]);

  function newConversation() {
    setMessages([]);
    setError(null);
    try {
      localStorage.setItem(CLEARED_KEY, new Date().toISOString());
    } catch {
      /* ignore */
    }
  }

  async function send(raw = input) {
    const text = raw.trim();
    if (!text || busy) return;
    const next: Message[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setWaiting(true);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-access-code": accessCode },
        body: JSON.stringify({ messages: next }),
      });
      if (res.status === 401) return onUnauthorized();
      if (!res.ok || !res.body) throw new Error((await res.json().catch(() => ({}))).error ?? "Erreur inconnue");
      // Lecture du flux : la bulle de Majordome se remplit au fil de l'eau.
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let reply = "";
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
  }

  // Une suggestion qui finit par un espace (« Ajoute une tâche : ») est à compléter : on la met dans le champ.
  function suggest(s: string) {
    if (s.endsWith(" ")) {
      setInput(s);
      inputRef.current?.focus();
    } else send(s);
  }

  return (
    <section className={`${hidden ? "hidden" : "flex"} min-h-0 flex-1 flex-col`}>
      <header className="flex h-14 items-center justify-between px-5">
        <h1 className="font-serif text-2xl font-medium tracking-wide">Majordome</h1>
        {messages.length > 0 && (
          <button onClick={newConversation} className="-mr-2 min-h-11 px-2 text-xs text-faint active:text-cream">
            Nouvelle conversation
          </button>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {messages.length === 0 && !waiting && (
          <div className="flex min-h-full flex-col justify-end gap-2">
            <p className="mb-4 px-1 font-serif text-xl text-muted">Bonjour Ruben. Que puis-je faire pour vous ?</p>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => suggest(s)}
                className="min-h-11 rounded-xl border border-line px-4 py-2.5 text-left text-sm text-muted transition-colors active:border-brass active:text-cream"
              >
                {s.trim()}
              </button>
            ))}
          </div>
        )}

        <div className="space-y-3 empty:hidden">
          {messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="rise ml-auto w-fit max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-raised px-4 py-2.5 text-[15px] leading-relaxed">
                {m.content}
              </div>
            ) : (
              <div key={i} className="rise md max-w-[92%] border-l border-brass/40 pl-3.5 text-[15px] leading-relaxed text-cream/95">
                <Markdown>{m.content}</Markdown>
              </div>
            ),
          )}
          {waiting && (
            <p className="flex items-center gap-2 pl-3.5 text-sm text-faint" aria-live="polite">
              Majordome écrit
              <span className="dots flex gap-0.5" aria-hidden>
                <span>·</span>
                <span>·</span>
                <span>·</span>
              </span>
            </p>
          )}
          {error && <p className="text-sm text-red-300">{error}</p>}
        </div>
        <div ref={bottomRef} />
      </div>

      <footer className="flex items-end gap-2 border-t border-line px-3 py-2.5">
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
          className="max-h-40 min-h-11 flex-1 resize-none rounded-2xl border border-line bg-surface px-4 py-2.5 text-[15px] leading-snug outline-none [field-sizing:content] placeholder:text-faint focus:border-brass/60"
        />
        <button
          onClick={() => send()}
          disabled={busy || !input.trim()}
          aria-label="Envoyer"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brass text-ink transition-opacity disabled:opacity-30"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </button>
      </footer>
    </section>
  );
}
