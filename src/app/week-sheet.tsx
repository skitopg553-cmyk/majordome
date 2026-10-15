"use client";

import { DEMO_WEEK_NOTE, demoWeekInput } from "@/lib/demo-data";
import { weekSummary } from "@/lib/mirror";
import Orb from "./orb";
import { DemoBanner, euro } from "./ui";

const fmt = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("fr-FR", { timeZone: "UTC", day: "numeric", month: "long" });

// « Ta semaine » (phase 6, APERÇU) : le vrai calcul (weekSummary) appliqué à une semaine fictive + un exemple de bilan.
export default function WeekSheet({ onClose }: { onClose: () => void }) {
  const s = weekSummary(demoWeekInput(), new Date());
  const tiles: [string, string, string][] = [
    ["Tâches faites", String(s.tasksDone), s.tasksLate ? `${s.tasksLate} en retard` : "aucune en retard"],
    ["Dépensé", euro(s.spent, false), s.topCategory ? `surtout ${s.topCategory.category.toLowerCase()}` : "—"],
    ["Sport", String(s.sessions), `séance${s.sessions > 1 ? "s" : ""}`],
  ];
  return (
    <section role="dialog" aria-label="Ta semaine" className="sheet-up fixed inset-0 z-50 mx-auto flex max-w-2xl flex-col bg-ink pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
      <header className="flex h-16 items-center px-3">
        <button onClick={onClose} aria-label="Fermer" className="flex size-11 items-center justify-center rounded-full text-muted active:bg-raised">
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
      </header>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-8">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight">Ta semaine</h1>
          <p className="text-[14px] text-muted">
            Du {fmt(s.from)} au {fmt(s.to)}
          </p>
        </div>
        <DemoBanner phase={6} />
        <div className="grid grid-cols-3 gap-2">
          {tiles.map(([k, v, sub]) => (
            <div key={k} className="rounded-2xl bg-surface px-3 py-4 text-center">
              <p className="text-[12px] text-muted">{k}</p>
              <p className="mt-1 text-[19px] font-semibold tabular-nums tracking-tight">{v}</p>
              <p className="mt-0.5 text-[11px] leading-tight text-faint">{sub}</p>
            </div>
          ))}
        </div>
        <div className="rounded-[22px] bg-surface p-5">
          <div className="flex items-center gap-3">
            <Orb state="idle" size={28} />
            <p className="text-[13px] font-medium text-muted">Le mot de Majordome</p>
          </div>
          <p className="mt-3 text-[15px] leading-relaxed">{DEMO_WEEK_NOTE}</p>
        </div>
        <p className="px-1 text-[12px] leading-snug text-faint">Chaque dimanche soir, Majordome écrira ce bilan à partir de tes vraies tâches, dépenses et séances.</p>
      </div>
    </section>
  );
}
