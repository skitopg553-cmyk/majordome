"use client";

import { useState } from "react";
import { DEFAULT_MINUTES, fromMin, toMin, type CalEvent } from "@/lib/calendar";
import type { StoredRule } from "@/lib/recurrence";
import { DAY_NAMES } from "@/lib/slots";
import { callApi } from "./api-client";

const LETTERS = ["L", "M", "M", "J", "V", "S", "D"];
const field = "h-12 w-full min-w-0 rounded-2xl bg-surface px-3 text-[15px] outline-none [color-scheme:dark] focus:ring-1 focus:ring-accent/50";
const btn = "flex min-h-12 w-full items-center justify-center rounded-2xl px-4 text-[15px] font-semibold active:scale-[0.98] disabled:opacity-50";

export type EditorTarget = { mode: "create"; day: string; start: string } | { mode: "edit"; event: CalEvent; shownDay: string; rule?: StoredRule };

/**
 * Fiche d'un événement : créer (depuis un créneau vide ou le bouton +) ou modifier (en touchant un pavé).
 * Titre, jour, début, fin, répétition (jours à cocher). Pour un événement qui revient : « cette fois seulement » ou « toute la série ».
 * Tout passe par /api/calendar, avec les mêmes règles que l'IA (titre propre, fin après le début, pas de doublon).
 */
export default function EventEditor({ target, accessCode, onUnauthorized, onDone, onClose }: { target: EditorTarget; accessCode: string; onUnauthorized: () => void; onDone: (msg: string) => void; onClose: () => void }) {
  const ev = target.mode === "edit" ? target.event : null;
  const recurring = !!ev?.recurring;
  const initialDays = target.mode === "edit" && target.rule ? (target.rule.days ?? String(target.rule.weekday ?? "")).split(",").filter(Boolean).map(Number) : [];
  const [title, setTitle] = useState(ev?.title ?? "");
  const [day, setDay] = useState(target.mode === "create" ? target.day : target.shownDay);
  const [start, setStart] = useState(ev?.start ?? (target.mode === "create" ? target.start : "09:00"));
  const [end, setEnd] = useState(ev?.end ?? fromMin(Math.min(toMin(target.mode === "create" ? target.start : "09:00") + DEFAULT_MINUTES, 1439)));
  const [days, setDays] = useState<number[]>(initialDays);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleDay = (d: number) => setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort()));
  const names = days.map((d) => DAY_NAMES[d - 1]);
  const valid = title.trim() && start && end && toMin(end) > toMin(start);
  const targetRef = ev ? (ev.source === "task" ? { kind: "task", id: ev.id } : { kind: "rule", id: ev.id, day: target.mode === "edit" ? target.shownDay : undefined }) : null;

  async function run(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const d = await callApi<{ done: string }>(accessCode, "/api/calendar", { method: "POST", body, onUnauthorized });
      onDone(d.done);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible pour le moment");
      setBusy(false);
    }
  }
  const save = (scope?: "once" | "series") =>
    run(
      ev
        ? { action: "update", target: targetRef, scope, title, day, start, end, ...(scope !== "once" ? { days: names } : {}) }
        : { action: "create", title, start, end, ...(names.length ? { days: names } : { day }) },
    );
  const remove = (scope?: "once" | "series") => {
    if (scope === "series" && !window.confirm(`Supprimer « ${ev!.title} » toutes les semaines ?`)) return;
    if (!recurring && !window.confirm(`Supprimer « ${ev!.title} » ?`)) return;
    void run({ action: "delete", target: targetRef, scope });
  };

  return (
    <section role="dialog" aria-label={ev ? "Modifier l'événement" : "Nouvel événement"} className="sheet-up fixed inset-0 z-50 mx-auto flex max-w-2xl flex-col bg-ink pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
      <header className="flex h-16 items-center gap-2 px-3">
        <button onClick={onClose} aria-label="Fermer" className="flex size-11 items-center justify-center rounded-full text-muted active:bg-raised">
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
        <h2 className="text-[17px] font-semibold tracking-tight">{ev ? "Modifier" : "Nouvel événement"}</h2>
      </header>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 pb-8">
        <label className="block">
          <span className="mb-1 block text-[13px] text-muted">Titre</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Cours, Boxe, Dentiste…" autoFocus={!ev} className={field} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[13px] text-muted">{recurring ? "Jour (pour « cette fois seulement »)" : "Jour"}</span>
          <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className={field} />
        </label>
        <div className="flex gap-2">
          <label className="block flex-1">
            <span className="mb-1 block text-[13px] text-muted">Début</span>
            <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className={field} />
          </label>
          <label className="block flex-1">
            <span className="mb-1 block text-[13px] text-muted">Fin</span>
            <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className={field} />
          </label>
        </div>
        {start && end && toMin(end) <= toMin(start) && <p className="text-[13px] text-neg">La fin doit être après le début.</p>}
        <div>
          <span className="mb-1 block text-[13px] text-muted">Répéter chaque semaine</span>
          <div className="flex gap-0.5" role="group" aria-label="Jours de répétition">
            {LETTERS.map((l, i) => (
              <button key={i} onClick={() => toggleDay(i + 1)} aria-pressed={days.includes(i + 1)} aria-label={DAY_NAMES[i]} className={`flex h-11 min-w-11 flex-1 items-center justify-center rounded-full text-[14px] font-semibold ${days.includes(i + 1) ? "bg-accent text-ink" : "bg-surface text-muted"}`}>
                {l}
              </button>
            ))}
          </div>
          {!days.length && <p className="mt-1 text-[12px] text-faint">Aucun jour coché : une seule fois.</p>}
        </div>

        <div className="space-y-2 pt-2">
          {recurring ? (
            <>
              <button disabled={busy || !valid} onClick={() => void save("once")} className={`${btn} bg-surface text-fg ring-1 ring-line`}>
                Enregistrer pour cette fois seulement
              </button>
              <button disabled={busy || !valid || !days.length} onClick={() => void save("series")} className={`${btn} bg-accent text-ink`}>
                Enregistrer pour toute la série
              </button>
              <button disabled={busy} onClick={() => remove("once")} className={`${btn} text-fg ring-1 ring-line`}>
                Supprimer cette fois
              </button>
              <button disabled={busy} onClick={() => remove("series")} className={`${btn} text-neg active:bg-raised`}>
                Supprimer toute la série
              </button>
            </>
          ) : (
            <>
              <button disabled={busy || !valid} onClick={() => void save()} className={`${btn} bg-accent text-ink`}>
                Enregistrer
              </button>
              {ev && (
                <button disabled={busy} onClick={() => remove()} className={`${btn} text-neg active:bg-raised`}>
                  Supprimer
                </button>
              )}
            </>
          )}
        </div>
        {error && <p className="text-[13px] text-neg">{error}</p>}
      </div>
    </section>
  );
}
