import type { Task } from "./use-tasks";

/**
 * Une tâche de l'Accueil : case ronde (coche) + titre (ouvre la fiche).
 * Cocher : la case se remplit, puis la ligne glisse vers la droite et disparaît (`leaving`, voir use-tasks), avec une courte vibration.
 * `prefers-reduced-motion` : plus de glissement, simple fondu.
 */
export default function TaskRow({ t, leaving, onToggle, onOpen }: { t: Task; leaving: boolean; onToggle: () => void; onOpen: () => void }) {
  const done = t.status === "done" || leaving;
  return (
    <li className={`flex items-center transition-all duration-300 ease-out ${leaving ? "translate-x-10 opacity-0 delay-150 motion-reduce:translate-x-0" : ""}`}>
      <button
        onClick={() => {
          if (!done) navigator.vibrate?.(15); // retour tactile court quand on coche (si l'appareil sait vibrer)
          onToggle();
        }}
        disabled={t.id < 0}
        aria-pressed={done}
        aria-label={done ? `Rouvrir : ${t.title}` : `Terminer : ${t.title}`}
        className="-ml-3 flex size-11 shrink-0 items-center justify-center"
      >
        <span className={`flex size-5 items-center justify-center rounded-full border transition-all duration-200 ${done ? "scale-110 border-accent bg-accent text-ink" : "border-faint"}`}>
          {done && (
            <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
              <path d="M5 12l5 5 9-10" />
            </svg>
          )}
        </span>
      </button>
      <button onClick={onOpen} disabled={t.id < 0} className={`flex min-h-11 min-w-0 flex-1 items-center gap-2 pr-1 text-left text-[15px] leading-snug ${done ? "text-faint line-through" : ""}`}>
        {t.priority === 1 && !done && <span className="size-1.5 shrink-0 rounded-full bg-accent" title="Priorité haute" />}
        <span className={`min-w-0 flex-1 ${t.priority === 3 && !done ? "text-muted" : ""}`}>{t.title}</span>
      </button>
    </li>
  );
}
