import type { Task } from "./use-tasks";
import { hhmm } from "./ui";

/** Une tâche réelle avec sa case ronde. `time` affiche l'heure à gauche (timeline du Planning). */
export default function TaskRow({ t, done, onToggle, time = false }: { t: Task; done: boolean; onToggle: () => void; time?: boolean }) {
  return (
    <li className="rise">
      <button onClick={onToggle} disabled={t.id < 0} aria-pressed={done} className="flex min-h-12 w-full items-start gap-3 py-2.5 text-left">
        {time && <span className="w-11 shrink-0 pt-0.5 text-xs tabular-nums text-faint">{t.due_at ? hhmm(t.due_at) : ""}</span>}
        <span
          className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border transition-all duration-300 ${
            done ? "scale-110 border-brass bg-brass text-ink" : "border-faint"
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
            {t.priority === 1 && <span className="size-1.5 shrink-0 rounded-full bg-brass" title="Priorité haute" />}
            <span className={t.priority === 3 && !done ? "text-muted" : ""}>{t.title}</span>
          </span>
          {!time && t.due_at && <span className="mt-0.5 block text-xs text-faint">{hhmm(t.due_at)}</span>}
        </span>
      </button>
    </li>
  );
}
