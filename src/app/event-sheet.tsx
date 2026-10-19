"use client";

import type { AgendaEvent } from "@/lib/google-api";

const fmt = (iso: string, o: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleString("fr-FR", { timeZone: "Europe/Paris", ...o });

/** Fiche d'un rendez-vous Google Agenda. Lecture seule (règle du projet) : on peut tout voir, mais ni modifier ni supprimer d'ici — le lien ouvre Google Agenda pour ça. */
export default function EventSheet({ e, onClose }: { e: AgendaEvent; onClose: () => void }) {
  const day = fmt(e.start, { weekday: "long", day: "numeric", month: "long" });
  const hours = e.allDay ? "Toute la journée" : `${fmt(e.start, { hour: "2-digit", minute: "2-digit" })} – ${fmt(e.end, { hour: "2-digit", minute: "2-digit" })}`;
  return (
    <section role="dialog" aria-label="Détail du rendez-vous" className="sheet-up fixed inset-0 z-50 mx-auto flex max-w-2xl flex-col bg-ink pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
      <header className="flex h-16 items-center px-3">
        <button onClick={onClose} aria-label="Fermer" className="flex size-11 items-center justify-center rounded-full text-muted active:bg-raised">
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
      </header>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-8">
        <h2 className="text-[22px] font-semibold leading-snug tracking-tight">{e.title}</h2>
        <div>
          <p className="text-[13px] text-muted">Quand</p>
          <p className="text-[16px] capitalize">{day}</p>
          <p className="text-[16px] tabular-nums">{hours}</p>
        </div>
        {e.place && (
          <div>
            <p className="text-[13px] text-muted">Lieu</p>
            <p className="text-[16px]">{e.place}</p>
          </div>
        )}
        {e.link && (
          <a href={e.link} target="_blank" rel="noopener noreferrer" className="flex min-h-12 items-center justify-center rounded-2xl bg-accent px-4 text-[15px] font-semibold text-ink active:scale-[0.98]">
            Ouvrir dans Google Agenda
          </a>
        )}
        <p className="text-[13px] leading-snug text-muted">Ce rendez-vous vient de ton Google Agenda. Majordome le lit seulement : pour le modifier ou le supprimer, ouvre-le dans Google Agenda.</p>
      </div>
    </section>
  );
}
