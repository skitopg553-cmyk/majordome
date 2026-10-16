import type { Task } from "./use-tasks";
import { hhmm } from "./ui";

/**
 * Une tâche réelle avec sa case ronde. `time` affiche l'heure à gauche (timeline du Planning).
 * `onPostpone` ajoute le bouton « Demain » (reporter en un geste).
 */
export default function TaskRow({ t, done, onToggle, onPostpone, onDelete, time = false }: { t: Task; done: boolean; onToggle: () => void; onPostpone?: () => void; onDelete?: () => void; time?: boolean }) {
  return (
    <li className="rise flex items-center">
      <button onClick={onToggle} disabled={t.id < 0} aria-pressed={done} className="flex min-h-12 min-w-0 flex-1 items-start gap-3 py-2.5 text-left">
        {time && <span className="w-11 shrink-0 pt-0.5 text-xs tabular-nums text-faint">{t.due_at ? hhmm(t.due_at) : ""}</span>}
        <span
          className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border transition-all duration-300 ${
            done ? "scale-110 border-accent bg-accent text-ink" : "border-faint"
          }`}
        >
          {done && (
            <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
              <path d="M5 12l5 5 9-10" />
            </svg>
          )}
        </span>
        <span className={`min-w-0 flex-1 transition-opacity duration-300 ${done ? "text-faint line-through opacity-60" : ""}`}>
          <span className="flex items-center gap-2 text-[15px] leading-snug">
            {t.priority === 1 && <span className="size-1.5 shrink-0 rounded-full bg-accent" title="Priorité haute" />}
            <span className={t.priority === 3 && !done ? "text-muted" : ""}>{t.title}</span>
          </span>
          {!time && t.due_at && <span className="mt-0.5 block text-xs text-faint">{hhmm(t.due_at)}</span>}
        </span>
      </button>
      {onDelete && t.id > 0 && (
        <button onClick={onDelete} aria-label={`Supprimer la tâche : ${t.title}`} className="-mr-2 ml-1 flex size-11 shrink-0 items-center justify-center rounded-full text-muted active:bg-raised active:text-neg">
          <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V4h6v3" />
          </svg>
        </button>
      )}
      {!onDelete && onPostpone && !done && t.id > 0 && (
        <button
          onClick={onPostpone}
          aria-label={`Reporter à demain : ${t.title}`}
          className="-mr-2 ml-1 flex min-h-11 shrink-0 items-center gap-1 rounded-full px-2.5 text-[12px] font-medium text-muted transition-colors active:bg-raised active:text-fg"
        >
          Demain
          <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      )}
    </li>
  );
}
