"use client";

import MemoryView from "./memory-view";

// Derrière l'avatar (comme dans les apps bancaires) : Mémoire & objectifs + Réglages.
export default function ProfileSheet({
  accessCode,
  speak,
  onSpeakChange,
  onNewConversation,
  onLogout,
  onClose,
  onUnauthorized,
}: {
  accessCode: string;
  speak: boolean;
  onSpeakChange: (v: boolean) => void;
  onNewConversation: () => void;
  onLogout: () => void;
  onClose: () => void;
  onUnauthorized: () => void;
}) {
  return (
    <section role="dialog" aria-label="Profil" className="sheet-up fixed inset-0 z-50 mx-auto flex max-w-2xl flex-col bg-ink pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
      <header className="flex h-16 items-center gap-2 px-3">
        <button onClick={onClose} aria-label="Fermer" className="flex size-11 items-center justify-center rounded-full text-muted active:bg-raised">
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8">
        <div className="flex flex-col items-center pb-6 text-center">
          <span className="flex size-20 items-center justify-center rounded-full bg-raised text-3xl font-medium ring-1 ring-line">R</span>
          <p className="mt-3 text-xl font-semibold">Ruben</p>
        </div>

        <h2 className="text-lg font-semibold">Mémoire & objectifs</h2>
        <MemoryView accessCode={accessCode} onUnauthorized={onUnauthorized} />

        <h2 className="mb-2 mt-10 text-lg font-semibold">Réglages</h2>
        <div className="divide-y divide-line/60 rounded-3xl bg-surface px-4">
          <label className="flex min-h-14 items-center justify-between gap-4">
            <span>
              <span className="block text-[15px]">Lire les réponses à voix haute</span>
              <span className="block text-xs text-faint">Quand tu parles à Majordome</span>
            </span>
            {/* Interrupteur : vraie case à cocher (accessible), dessinée en pilule */}
            <input type="checkbox" role="switch" checked={speak} onChange={(e) => onSpeakChange(e.target.checked)} className="peer sr-only" />
            <span
              aria-hidden
              className="relative h-7 w-12 shrink-0 rounded-full bg-raised ring-1 ring-line transition-colors duration-200 after:absolute after:left-1 after:top-1 after:size-5 after:rounded-full after:bg-muted after:transition-transform after:duration-200 peer-checked:bg-accent/25 peer-checked:ring-accent/50 peer-checked:after:translate-x-5 peer-checked:after:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-accent"
            />
          </label>
          <button onClick={onNewConversation} className="flex min-h-14 w-full items-center text-left text-[15px]">
            Nouvelle conversation
          </button>
          <button onClick={onLogout} className="flex min-h-14 w-full items-center text-left text-[15px] text-neg">
            Se déconnecter de cet appareil
          </button>
        </div>
      </div>
    </section>
  );
}
