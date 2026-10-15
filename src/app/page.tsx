"use client";

import { useEffect, useRef, useState } from "react";

type Message = { role: "user" | "assistant"; content: string };

const STORAGE_KEY = "majordome-access-code";

export default function ChatPage() {
  const [accessCode, setAccessCode] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Le code d'accès est mémorisé sur ce téléphone pour ne pas le retaper à chaque fois.
  useEffect(() => {
    try {
      setAccessCode(localStorage.getItem(STORAGE_KEY));
    } catch {
      /* stockage indisponible : on redemandera le code */
    }
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  function saveCode() {
    const code = codeInput.trim();
    if (!code) return;
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      /* ignore */
    }
    setAccessCode(code);
  }

  async function send() {
    const text = input.trim();
    if (!text || loading || !accessCode) return;
    const next: Message[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-access-code": accessCode },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      if (res.status === 401) {
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch {
          /* ignore */
        }
        setAccessCode(null);
        throw new Error("Code d'accès incorrect");
      }
      if (!res.ok) throw new Error(data.error ?? "Erreur inconnue");
      setMessages([...next, { role: "assistant", content: data.reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  if (!accessCode) {
    return (
      <main className="flex min-h-full items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-4">
          <h1 className="text-2xl font-semibold">Majordome</h1>
          <p className="text-sm text-neutral-400">Entre ton code d&apos;accès.</p>
          <input
            type="password"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveCode()}
            className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 outline-none focus:border-neutral-400"
            autoFocus
          />
          <button onClick={saveCode} className="w-full rounded-lg bg-neutral-100 py-2 font-medium text-neutral-900">
            Entrer
          </button>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex h-full max-w-2xl flex-col">
      <header className="border-b border-neutral-800 px-4 py-3">
        <h1 className="font-semibold">Majordome</h1>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <p className="pt-10 text-center text-neutral-500">Bonjour Ruben. Qu&apos;est-ce que je peux faire pour toi ?</p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 ${
              m.role === "user" ? "ml-auto bg-neutral-100 text-neutral-900" : "bg-neutral-800"
            }`}
          >
            {m.content}
          </div>
        ))}
        {loading && <div className="w-fit rounded-2xl bg-neutral-800 px-4 py-2 text-neutral-400">…</div>}
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div ref={bottomRef} />
      </div>

      <footer className="flex gap-2 border-t border-neutral-800 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Écris à Majordome…"
          className="flex-1 rounded-full border border-neutral-700 bg-neutral-900 px-4 py-2 outline-none focus:border-neutral-400"
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          className="rounded-full bg-neutral-100 px-4 font-medium text-neutral-900 disabled:opacity-40"
        >
          Envoyer
        </button>
      </footer>
    </main>
  );
}
