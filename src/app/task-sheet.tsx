"use client";

import { useState } from "react";
import type { Task, TasksApi } from "./use-tasks";

const pad = (n: number) => String(n).padStart(2, "0");
/** ISO → valeur d'un champ datetime-local (heure de l'appareil, comme à l'ajout). */
const toInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const PRIORITIES = [
  [1, "Haute"],
  [2, "Normale"],
  [3, "Basse"],
] as const;

/** Fiche d'une tâche : modifier, terminer, reporter, supprimer. Toutes les zones tactiles font au moins 44 px. */
export default function TaskSheet({ t, api, onClose }: { t: Task; api: TasksApi; onClose: () => void }) {
  const [title, setTitle] = useState(t.title);
  const [due, setDue] = useState(toInput(t.due_at));
  const [priority, setPriority] = useState(t.priority);
  const [notes, setNotes] = useState(t.notes ?? "");
  const done = t.status === "done";

  const fields = {
    ...(title.trim() && title.trim() !== t.title ? { title: title.trim() } : {}),
    ...(due !== toInput(t.due_at) ? { due_at: due ? new Date(due).toISOString() : null } : {}),
    ...(priority !== t.priority ? { priority } : {}),
    ...(notes.trim() !== (t.notes ?? "") ? { notes: notes.trim() } : {}),
  };
  const dirty = Object.keys(fields).length > 0;
  const input = "w-full rounded-2xl bg-surface px-4 text-[15px] outline-none placeholder:text-faint focus:ring-1 focus:ring-accent/50";

  return (
    <section role="dialog" aria-label="Détail de la tâche" className="sheet-up fixed inset-0 z-50 mx-auto flex max-w-2xl flex-col bg-ink pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
      <header className="flex h-16 items-center px-3">
        <button onClick={onClose} aria-label="Fermer" className="flex size-11 items-center justify-center rounded-full text-muted active:bg-raised">
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
      </header>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 pb-8">
        <label className="block">
          <span className="mb-1 block text-[13px] text-muted">Titre</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} className={`${input} h-12`} />
        </label>
        <div>
          <span className="mb-1 block text-[13px] text-muted">Échéance</span>
          <div className="flex gap-2">
            <input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Échéance" className={`${input} h-12 min-w-0 flex-1 text-muted [color-scheme:dark]`} />
            {due && (
              <button onClick={() => setDue("")} className="min-h-12 shrink-0 rounded-2xl bg-surface px-4 text-[13px] font-medium text-muted active:bg-raised">
                Retirer
              </button>
            )}
          </div>
        </div>
        <div>
          <span className="mb-1 block text-[13px] text-muted">Priorité</span>
          <div className="grid grid-cols-3 rounded-full bg-surface p-1" role="radiogroup" aria-label="Priorité">
            {PRIORITIES.map(([v, name]) => (
              <button key={v} role="radio" aria-checked={priority === v} onClick={() => setPriority(v)} className={`min-h-11 rounded-full text-[13px] font-medium transition-colors ${priority === v ? "bg-raised text-fg" : "text-muted"}`}>
                {name}
              </button>
            ))}
          </div>
        </div>
        <label className="block">
          <span className="mb-1 block text-[13px] text-muted">Notes</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} rows={3} className={`${input} py-3`} />
        </label>

        <div className="space-y-2 pt-2">
          {dirty && (
            <button
              onClick={() => {
                void api.update(t, fields);
                onClose();
              }}
              className="min-h-12 w-full rounded-full bg-accent text-[15px] font-semibold text-ink"
            >
              Enregistrer
            </button>
          )}
          <button
            onClick={() => {
              api.toggle(t);
              onClose();
            }}
            className={`min-h-12 w-full rounded-full text-[15px] font-semibold ${dirty ? "bg-raised text-fg" : "bg-accent text-ink"}`}
          >
            {done ? "Rouvrir" : "Terminer"}
          </button>
          {!done && (
            <button
              onClick={() => {
                api.postpone(t);
                onClose();
              }}
              className="min-h-12 w-full rounded-full bg-raised text-[15px] font-medium text-fg"
            >
              Reporter à demain
            </button>
          )}
          <button
            onClick={() => {
              api.remove(t); // demande confirmation ; si on annule, la tâche reste
              onClose();
            }}
            className="min-h-12 w-full rounded-full text-[15px] font-medium text-muted active:text-neg"
          >
            Supprimer
          </button>
        </div>
      </div>
    </section>
  );
}
