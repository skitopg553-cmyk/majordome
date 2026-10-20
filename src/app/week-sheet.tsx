"use client";

import { useEffect, useState } from "react";
import type { Mirror } from "@/lib/mirror";
import Majordome from "./majordome";
import { euro } from "./ui";

const fmt = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("fr-FR", { timeZone: "UTC", day: "numeric", month: "long" });
const hours = (h: number) => `${Math.floor(h)} h ${String(Math.round((h % 1) * 60)).padStart(2, "0")}`;

// « Ta semaine » : chiffres RÉELS calculés en code (GET /api/week) + 2-3 phrases de Majordome à partir de ces chiffres.
export default function WeekSheet({ accessCode, onClose, onUnauthorized }: { accessCode: string; onClose: () => void; onUnauthorized: () => void }) {
  const [data, setData] = useState<{ mirror: Mirror; note: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/week", { headers: { "x-access-code": accessCode } })
      .then(async (r) => {
        if (r.status === 401) return onUnauthorized();
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error ?? `Erreur serveur (${r.status})`);
        setData(d);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Impossible de charger la semaine"));
  }, [accessCode, onUnauthorized]);

  const m = data?.mirror;
  const tiles: [string, string, string][] = m
    ? [
        ["Pense-bêtes faits", String(m.tasksDone), m.tasksLate ? `${m.tasksLate} en retard` : "aucun en retard"],
        ["Dépensé", euro(m.spent, false), m.spentDeltaPct === null ? (m.topCategory ? `surtout ${m.topCategory.category.toLowerCase()}` : "—") : `${m.spentDeltaPct > 0 ? "+" : "−"}${Math.abs(m.spentDeltaPct)} % vs semaine passée`],
        ["Sport", String(m.sessions), `séance${m.sessions > 1 ? "s" : ""} · ${m.activeDays} jour${m.activeDays > 1 ? "s" : ""}`],
        ...(m.sleepAvg !== null ? ([["Sommeil", hours(m.sleepAvg), `par nuit · ${m.nights} notée${m.nights > 1 ? "s" : ""}`]] as [string, string, string][]) : []),
        ...(m.kcalAvg !== null ? ([["Repas", m.kcalAvg.toLocaleString("fr-FR"), `kcal par jour · ${m.mealDays} jour${m.mealDays > 1 ? "s" : ""}`]] as [string, string, string][]) : []),
      ]
    : [];
  return (
    <section role="dialog" aria-label="Votre semaine" className="sheet-up fixed inset-0 z-50 mx-auto flex max-w-2xl flex-col bg-ink pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
      <header className="flex h-16 items-center px-3">
        <button onClick={onClose} aria-label="Fermer" className="flex size-11 items-center justify-center rounded-full text-muted active:bg-raised">
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
      </header>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-8">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight">Votre semaine</h1>
          {m && (
            <p className="text-[14px] text-muted">
              Du {fmt(m.from)} au {fmt(m.to)}
            </p>
          )}
        </div>
        {error && <p className="text-[14px] text-neg">{error}</p>}
        {!data && !error && (
          <div className="space-y-3" aria-busy="true" aria-label="Chargement">
            <div className="h-24 animate-pulse rounded-2xl bg-surface" />
            <div className="h-32 animate-pulse rounded-[22px] bg-surface" />
          </div>
        )}
        {m && (
          <>
            <div className="grid grid-cols-2 gap-2">
              {tiles.map(([k, v, sub]) => (
                <div key={k} className="rounded-2xl bg-surface px-3 py-4 text-center">
                  <p className="text-[12px] text-muted">{k}</p>
                  <p className="mt-1 text-[19px] font-semibold tabular-nums tracking-tight">{v}</p>
                  <p className="mt-0.5 text-[11px] leading-tight text-faint">{sub}</p>
                </div>
              ))}
            </div>
            {data?.note && (
              <div className="rounded-[22px] bg-surface p-5">
                <div className="flex items-center gap-3">
                  <Majordome size={14} fond="#111215" />
                  <p className="text-[13px] font-medium text-muted">Le mot de Majordome</p>
                </div>
                <p className="mt-3 text-[15px] leading-relaxed">{data.note}</p>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
