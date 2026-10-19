"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ChatView, { type ChatHandle } from "./chat-view";
import { isStatement, shortcutFromSearch } from "@/lib/shortcuts";
import HomeView from "./home-view";
import Majordome from "./majordome";
import { Wordmark } from "./ui";
import { useGoogle } from "./use-google";
import { useSlots } from "./use-slots";
import Splash from "./splash";
import { useTasks } from "./use-tasks";
import dynamic from "next/dynamic";

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

  if (!ready) return <Splash show />;

  if (!accessCode) {
    return (
      <main className="flex min-h-full items-center justify-center px-6">
        <div className="w-full max-w-xs space-y-6 text-center">
          <span className="mx-auto flex size-24 items-center justify-center rounded-full bg-ink">
            <Majordome size={40} />
          </span>
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

// Écrans ouverts à la demande : hors du premier chargement (l'Accueil et le chat, eux, sont tout de suite là).
const WeekSheet = dynamic(() => import("./week-sheet"), { ssr: false });
const FinancesView = dynamic(() => import("./finances-view"), { ssr: false });
const FormeView = dynamic(() => import("./forme-view"), { ssr: false });
const PlanningView = dynamic(() => import("./planning-view"), { ssr: false });
const ProfileSheet = dynamic(() => import("./profile-sheet"), { ssr: false });

function App({ accessCode, onForget }: { accessCode: string; onForget: (message: string | null) => void }) {
  const [tab, setTab] = useState<Tab>("home");
  const [chatOpen, setChatOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [weekOpen, setWeekOpen] = useState(false);
  const [sharedFile, setSharedFile] = useState<File | null>(null); // relevé partagé depuis une autre appli (voir public/sw.js)
  const [bankNotice, setBankNotice] = useState<{ ok: boolean; text: string } | null>(null);

  // Raccourcis Android (/?action=…) et fichier partagé (/?partage=1) : on les traite puis on nettoie l'adresse.
  useEffect(() => {
    const sc = shortcutFromSearch(window.location.search);
    if (sc) {
      setChatOpen(true);
      if (sc.prefill) setTimeout(() => chat.current?.prefill(sc.prefill), 150);
      window.history.replaceState(null, "", window.location.pathname);
    }
    if (new URLSearchParams(window.location.search).get("partage")) {
      window.history.replaceState(null, "", window.location.pathname);
      caches
        .open("partage")
        .then(async (cache) => {
          const res = await cache.match("/partage-fichier");
          if (!res) return;
          const name = decodeURIComponent(res.headers.get("x-nom") ?? "releve.csv");
          const blob = await res.blob();
          await cache.delete("/partage-fichier");
          if (isStatement(name, blob.type)) {
            setSharedFile(new File([blob], name, { type: blob.type }));
            setTab("finances");
          }
        })
        .catch(() => {});
    }
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {}); // nécessaire à la cible de partage
  }, []);

  // Retour de la banque : /?bank=ok (ou erreur / refuse + msg brut) → on ouvre Finances avec le résultat, puis on nettoie l'adresse.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const bank = q.get("bank");
    if (!bank) return;
    setTab("finances");
    setBankNotice(bank === "ok" ? { ok: true, text: "Banque connectée. Touche « Actualiser » pour lire ton solde et tes opérations." } : { ok: false, text: bank === "refuse" ? "Connexion refusée côté banque." + (q.get("msg") ? ` ${q.get("msg")}` : "") : (q.get("msg") ?? "La connexion a échoué.") });
    window.history.replaceState(null, "", window.location.pathname);
  }, []);
  const [version, setVersion] = useState(0); // +1 à chaque fermeture du chat : Majordome a pu écrire (Forme, Finances…), les écrans se rechargent
  const [speak, setSpeak] = useState(true);
  const chat = useRef<ChatHandle>(null);
  const unauthorized = useCallback(() => onForget("Code d'accès incorrect"), [onForget]);
  const tasks = useTasks(accessCode, unauthorized);
  const google = useGoogle(accessCode, unauthorized);
  const slots = useSlots(accessCode, unauthorized);
  const reloadSlots = slots.reload;
  useEffect(() => {
    if (version) reloadSlots(); // le chat vient de se fermer : il a pu créer des créneaux
  }, [version, reloadSlots]);
  const [googleNotice, setGoogleNotice] = useState<string | null>(null);
  // Retour de Google : /?google=ok | refuse | lien-expire | erreur | table-manquante | sans-acces-hors-ligne → un message simple sur l'Accueil.
  useEffect(() => {
    const g = new URLSearchParams(window.location.search).get("google");
    if (!g) return;
    window.history.replaceState(null, "", window.location.pathname);
    const texts: Record<string, string> = {
      ok: "Google est connecté. Ton agenda et tes mails vont apparaître.",
      refuse: "Connexion Google refusée de ton côté. Tu peux réessayer quand tu veux.",
      "lien-expire": "Le lien de connexion a expiré (10 minutes). Relance la connexion.",
      "table-manquante": "Connexion faite, mais la base n'est pas prête (migration 0006 à appliquer).",
      "sans-acces-hors-ligne": "Google n'a pas donné l'accès durable. Relance la connexion et accepte tout.",
    };
    setGoogleNotice(texts[g] ?? "La connexion Google a échoué. Réessaie.");
    if (g === "ok") google.refresh();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
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
      <Splash show={!tasks.loaded} />
      <div key={version} className="min-h-0 flex-1 overflow-y-auto pt-[env(safe-area-inset-top)]">
        {tab === "home" && <HomeView accessCode={accessCode} tasks={tasks} google={google} googleNotice={googleNotice} go={setTab} onAvatar={openProfile} onWeek={() => setWeekOpen(true)} />}
        {tab === "planning" && <PlanningView tasks={tasks} google={google} slots={slots} accessCode={accessCode} onUnauthorized={unauthorized} onAvatar={openProfile} />}
        {tab === "finances" && <FinancesView accessCode={accessCode} onUnauthorized={unauthorized} onAvatar={openProfile} bankNotice={bankNotice} sharedFile={sharedFile} onSharedDone={() => setSharedFile(null)} />}
        {tab === "forme" && <FormeView accessCode={accessCode} onUnauthorized={unauthorized} onAvatar={openProfile} />}
      </div>

      {/* Barre du bas : 4 sections + Majordome au centre, plus gros et surélevé */}
      <nav className="relative grid grid-cols-5 border-t border-line/70 bg-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        {LEFT.map(tabButton)}
        <div className="relative flex justify-center">
          <button onClick={talk} aria-label="Parler à Majordome" className="absolute -top-7 rounded-full border-[5px] border-ink transition-transform active:scale-95">
            <span className="flex size-16 items-center justify-center rounded-full bg-ink shadow-[0_0_24px_rgba(108,242,255,0.16)] ring-1 ring-line/70">
              <Majordome size={26} />
            </span>
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
        onClose={() => {
          setChatOpen(false);
          setVersion((v) => v + 1);
        }}
        onUnauthorized={unauthorized}
        onSpeakChange={changeSpeak}
      />

      {weekOpen && <WeekSheet accessCode={accessCode} onClose={() => setWeekOpen(false)} onUnauthorized={unauthorized} />}

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
