"use client";

import { useEffect, useState } from "react";
import ChatView from "./chat-view";
import TasksView from "./tasks-view";

const STORAGE_KEY = "majordome-access-code";

const TABS = [
  { id: "chat", label: "Chat", icon: "M4 5h16v11H8l-4 4z" },
  { id: "tasks", label: "Tâches", icon: "M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" },
] as const;
type Tab = (typeof TABS)[number]["id"];

export default function Home() {
  const [accessCode, setAccessCode] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("chat");

  // Le code d'accès est mémorisé sur ce téléphone pour ne pas le retaper à chaque fois.
  useEffect(() => {
    try {
      setAccessCode(localStorage.getItem(STORAGE_KEY));
    } catch {
      /* stockage indisponible : on redemandera le code */
    }
    setReady(true);
  }, []);

  function saveCode() {
    const code = codeInput.trim();
    if (!code) return;
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      /* ignore */
    }
    setCodeError(null);
    setAccessCode(code);
  }

  // Appelé par les vues quand le serveur répond 401 : on redemande le code.
  function unauthorized() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setAccessCode(null);
    setCodeError("Code d'accès incorrect");
  }

  if (!ready) return null;

  if (!accessCode) {
    return (
      <main className="flex min-h-full items-center justify-center px-6">
        <div className="w-full max-w-xs space-y-6 text-center">
          <h1 className="font-serif text-5xl font-medium tracking-wide">Majordome</h1>
          <div className="mx-auto h-px w-12 bg-brass" />
          <input
            type="password"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveCode()}
            placeholder="Code d'accès"
            aria-label="Code d'accès"
            className="h-12 w-full rounded-xl border border-line bg-surface px-4 text-center outline-none placeholder:text-faint focus:border-brass"
            autoFocus
          />
          <button onClick={saveCode} className="h-12 w-full rounded-xl bg-cream font-medium text-ink active:opacity-80">
            Entrer
          </button>
          {codeError && <p className="text-sm text-red-300">{codeError}</p>}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex h-dvh max-w-2xl flex-col pt-[env(safe-area-inset-top)]">
      {/* Les vues restent montées (masquées) : une réponse en cours continue même si on change d'onglet. */}
      <ChatView accessCode={accessCode} hidden={tab !== "chat"} onUnauthorized={unauthorized} />
      <TasksView accessCode={accessCode} hidden={tab !== "tasks"} onUnauthorized={unauthorized} />

      <nav className="flex border-t border-line bg-ink pb-[env(safe-area-inset-bottom)]">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? "page" : undefined}
            className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[11px] tracking-wide transition-colors ${
              tab === t.id ? "text-brass" : "text-faint"
            }`}
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d={t.icon} />
            </svg>
            {t.label}
          </button>
        ))}
      </nav>
    </main>
  );
}
