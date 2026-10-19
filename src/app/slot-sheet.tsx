"use client";

import { useState } from "react";
import type { Occurrence } from "@/lib/slots";
import { daysLabel } from "@/lib/slots";
import { parisDay } from "@/lib/task-groups";
import { confirmDelete, deleteEntry } from "./delete-entry";
import { hhmm } from "./ui";
import type { SlotsApi } from "./use-slots";

const field = "h-12 min-w-0 flex-1 rounded-2xl bg-surface px-3 text-[15px] outline-none [color-scheme:dark] focus:ring-1 focus:ring-accent/50";
const btn = "flex min-h-12 w-full items-center justify-center rounded-2xl px-4 text-[15px] font-semibold active:scale-[0.98] disabled:opacity-50";

/**
 * Fiche d'une occurrence d'un créneau qui revient. Trois choix, du plus léger au plus lourd :
 * supprimer CETTE fois, déplacer CETTE fois (la série ne bouge pas), supprimer TOUTE la série (avec confirmation).
 */
export default function SlotSheet({ o, slots, accessCode, onUnauthorized, onClose }: { o: Occurrence; slots: SlotsApi; accessCode: string; onUnauthorized: () => void; onClose: () => void }) {
  const rule = slots.rules.find((r) => r.id === o.ruleId);
  const [moving, setMoving] = useState(false);
  const [day, setDay] = useState(parisDay(new Date(o.start)));
  const [start, setStart] = useState(hhmm(o.start));
  const [end, setEnd] = useState(o.end ? hhmm(o.end) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const when = new Date(o.start).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", weekday: "long", day: "numeric", month: "long" });
  const hours = o.end ? `${hhmm(o.start)} – ${hhmm(o.end)}` : hhmm(o.start);
  const label = rule?.kind === "weekly" && rule.days ? `Chaque semaine : ${daysLabel(rule.days)}` : "Revient régulièrement";

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible pour le moment");
      setBusy(false);
    }
  }

  return (
    <section role="dialog" aria-label="Détail du créneau" className="sheet-up fixed inset-0 z-50 mx-auto flex max-w-2xl flex-col bg-ink pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
      <header className="flex h-16 items-center px-3">
        <button onClick={onClose} aria-label="Fermer" className="flex size-11 items-center justify-center rounded-full text-muted active:bg-raised">
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
      </header>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-8">
        <h2 className="break-words text-[22px] font-semibold leading-snug tracking-tight">{o.title}</h2>
        <div>
          <p className="text-[13px] text-muted">Cette fois</p>
          <p className="text-[16px] capitalize">{when}</p>
          <p className="text-[16px] tabular-nums">{hours}</p>
          {o.moved && <p className="mt-1 text-[13px] text-muted">Déplacé (la série n&apos;a pas changé).</p>}
        </div>
        <p className="text-[13px] text-muted">
          {label}
          {o.habit ? " · habitude à confirmer" : ""}
        </p>

        {moving ? (
          <div className="rise space-y-2">
            <input type="date" value={day} onChange={(e) => setDay(e.target.value)} aria-label="Nouveau jour" className={`${field} w-full`} />
            <div className="flex gap-2">
              <input type="time" value={start} onChange={(e) => setStart(e.target.value)} aria-label="Début" className={field} />
              <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} aria-label="Fin (facultatif)" className={field} />
            </div>
            <button disabled={busy || !day || !start} onClick={() => run(() => slots.act({ action: "move", rule_id: o.ruleId, day: o.originDay, new_day: day, new_start: start, new_end: end || undefined }))} className={`${btn} bg-accent text-ink`}>
              Déplacer cette fois
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <button disabled={busy} onClick={() => setMoving(true)} className={`${btn} bg-surface text-fg ring-1 ring-line`}>
              Déplacer cette fois
            </button>
            <button disabled={busy} onClick={() => run(() => slots.act({ action: "skip", rule_id: o.ruleId, day: o.originDay }))} className={`${btn} bg-surface text-fg ring-1 ring-line`}>
              Supprimer cette fois
            </button>
            <button
              disabled={busy}
              onClick={() => confirmDelete(`toute la série « ${o.title} » (toutes les semaines)`) && run(async () => {
                await deleteEntry(accessCode, { table: "recurring_tasks", id: o.ruleId }, onUnauthorized);
                slots.reload();
              })}
              className={`${btn} text-neg active:bg-raised`}
            >
              Supprimer toute la série
            </button>
          </div>
        )}
        {error && <p className="text-[13px] text-neg">{error}</p>}
      </div>
    </section>
  );
}
