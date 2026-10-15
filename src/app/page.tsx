"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ChatView, { type ChatHandle } from "./chat-view";
import FinancesView from "./finances-view";
import FormeView from "./forme-view";
import HomeView from "./home-view";
import Orb, { type OrbState } from "./orb";
import { Wordmark } from "./ui";
import PlanningView from "./planning-view";
import ProfileSheet from "./profile-sheet";
import { useTasks } from "./use-tasks";
import WeekSheet from "./week-sheet";

const STORAGE_KEY = "majordome-access-code";
const SPEAK_KEY = "majordome-speak";

type Tab = "home" | "planning" | "finances" | "forme";
const LEFT: { id: Tab; label: string; icon: string }[] = [
  { id: "home", label: "Accueil", icon: "M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" },
  { id: "planning", label: "Planning", icon: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M8 14h3" },
];
const RIGHT: { id: Tab; label: string; icon: string }[] = [
  { id: "finances", label: "Finances", icon: "M3 7h18v11H3zM3 11h18M7 15h3" },
  { id: "forme", label: "Forme", icon: "M3 12h4l2-5 4 10 2-5h6" },
];

export default function Home() {
  const [accessCode, setAccessCode] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);

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

  // Appelé quand le serveur répond 401 (ou à la déconnexion) : on redemande le code.
  const forgetCode = useCallback((message: string | null) => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setAccessCode(null);
    setCodeError(message);
  }, []);

  if (!ready) return null;

  if (!accessCode) {
    return (
      <main className="flex min-h-full items-center justify-center px-6">
        <div className="w-full max-w-xs space-y-6 text-center">
          <Orb state="idle" size={72} />
          <h1><Wordmark className="text-[40px]" /></h1>
          <input
            type="password"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveCode()}
            placeholder="Code d'accès"
            aria-label="Code d'accès"
            className="h-12 w-full rounded-2xl bg-surface px-4 text-center outline-none placeholder:text-faint focus:ring-1 focus:ring-accent/50"
            autoFocus
          />
          <button onClick={saveCode} className="h-12 w-full rounded-2xl bg-fg font-medium text-ink active:opacity-80">
            Entrer
          </button>
          {codeError && <p className="text-sm text-neg">{codeError}</p>}
        </div>
      </main>
    );
  }

  return <App accessCode={accessCode} onForget={forgetCode} />;
}

function App({ accessCode, onForget }: { accessCode: string; onForget: (message: string | null) => void }) {
  const [tab, setTab] = useState<Tab>("home");
  const [chatOpen, setChatOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [weekOpen, setWeekOpen] = useState(false);
  const [orb, setOrb] = useState<OrbState>("idle");
  const [speak, setSpeak] = useState(true);
  const chat = useRef<ChatHandle>(null);
  const unauthorized = useCallback(() => onForget("Code d'accès incorrect"), [onForget]);
  const tasks = useTasks(accessCode, unauthorized);
  const { load } = tasks;

  useEffect(() => {
    try {
      setSpeak(localStorage.getItem(SPEAK_KEY) !== "0");
    } catch {
      /* ignore */
    }
  }, []);

  // Tâches rechargées en revenant sur l'Accueil / le Planning, ou en fermant le chat (l'IA a pu en créer).
  useEffect(() => {
    if (!chatOpen && (tab === "home" || tab === "planning")) load();
  }, [tab, chatOpen, load]);

  function changeSpeak(v: boolean) {
    setSpeak(v);
    try {
      localStorage.setItem(SPEAK_KEY, v ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  // Appui sur l'orbe : on ouvre le chat et on lance la dictée dans le même geste (exigé par le navigateur).
  function talk() {
    setChatOpen(true);
    chat.current?.listen();
  }

  function type() {
    setChatOpen(true);
    chat.current?.focusInput();
  }

  const tabButton = (t: { id: Tab; label: string; icon: string }) => (
    <button
      key={t.id}
      onClick={() => setTab(t.id)}
      aria-current={tab === t.id ? "page" : undefined}
      className={`flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] tracking-wide transition-colors ${tab === t.id ? "text-fg" : "text-faint"}`}
    >
      <svg viewBox="0 0 24 24" className="size-[22px]" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={t.icon} />
      </svg>
      {t.label}
    </button>
  );

  const openProfile = () => setProfileOpen(true);

  return (
    <main className="mx-auto flex h-dvh max-w-2xl flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto pt-[env(safe-area-inset-top)]">
        {tab === "home" && <HomeView tasks={tasks} go={setTab} onAvatar={openProfile} onWeek={() => setWeekOpen(true)} />}
        {tab === "planning" && <PlanningView tasks={tasks} onAvatar={openProfile} />}
        {tab === "finances" && <FinancesView accessCode={accessCode} onUnauthorized={unauthorized} onAvatar={openProfile} />}
        {tab === "forme" && <FormeView accessCode={accessCode} onUnauthorized={unauthorized} onAvatar={openProfile} />}
      </div>

      {/* Barre du bas : 4 sections + Majordome au centre, plus gros et surélevé */}
      <nav className="relative grid grid-cols-5 border-t border-line/70 bg-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        {LEFT.map(tabButton)}
        <div className="relative flex justify-center">
          <button onClick={talk} aria-label="Parler à Majordome" className="absolute -top-7 rounded-full border-[5px] border-ink transition-transform active:scale-95">
            <Orb state={chatOpen ? orb : "idle"} size={64} />
          </button>
          <button
            onClick={type}
            aria-label="Écrire à Majordome"
            className="absolute -top-8 left-1/2 ml-7 flex size-8 items-center justify-center rounded-full border border-line bg-raised text-muted before:absolute before:-inset-1.5 active:text-fg"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
              <rect x="3" y="6" width="18" height="12" rx="2" />
              <path d="M7 10h.01M11 10h.01M15 10h.01M8 14h8" />
            </svg>
          </button>
        </div>
        {RIGHT.map(tabButton)}
      </nav>

      <ChatView
        ref={chat}
        accessCode={accessCode}
        open={chatOpen}
        speak={speak}
        onClose={() => setChatOpen(false)}
        onUnauthorized={unauthorized}
        onState={setOrb}
      />

      {weekOpen && <WeekSheet onClose={() => setWeekOpen(false)} />}

      {profileOpen && (
        <ProfileSheet
          accessCode={accessCode}
          speak={speak}
          onSpeakChange={changeSpeak}
          onNewConversation={() => {
            chat.current?.newConversation();
            setProfileOpen(false);
          }}
          onLogout={() => onForget(null)}
          onClose={() => setProfileOpen(false)}
          onUnauthorized={unauthorized}
        />
      )}
    </main>
  );
}
