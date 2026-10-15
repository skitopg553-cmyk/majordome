"use client";

import { DEMO_FINANCES, DEMO_FORME, DEMO_PHASE, demoEvents } from "@/lib/demo-data";
import { groupOf } from "@/lib/task-groups";
import TaskRow from "./task-row";
import { Bar, Card, DemoBanner, euro, greeting, Header, hhmm } from "./ui";
import type { TasksApi } from "./use-tasks";

type Go = (tab: "planning" | "finances" | "forme") => void;

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;

export default function HomeView({ tasks: api, go, onAvatar }: { tasks: TasksApi; go: Go; onAvatar: () => void }) {
  const now = new Date();
  const todo = api.tasks.filter((t) => t.status === "todo" || api.leaving.has(t.id));
  const late = todo.filter((t) => groupOf(t.due_at, now) === "En retard");
  const today = todo.filter((t) => groupOf(t.due_at, now) === "Aujourd'hui");
  const focus = [...late, ...today].sort((a, b) => a.priority - b.priority || (a.due_at ?? "").localeCompare(b.due_at ?? ""));
  const next = demoEvents().find((e) => new Date(e.end) > now);
  const f = DEMO_FINANCES;
  const s = DEMO_FORME;

  // Résumé calculé en code (pas par l'IA) à partir des vraies tâches.
  const summary = !api.loaded
    ? "…"
    : focus.length === 0
      ? "Rien d'urgent aujourd'hui. Journée libre côté tâches."
      : `${plural(today.length, "tâche")} aujourd'hui${late.length ? `, ${plural(late.length, "en retard")}` : ""}.`;

  return (
    <div className="space-y-3 px-4 pb-6">
      <Header
        title={`${greeting(now)}, Ruben`}
        subtitle={now.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", weekday: "long", day: "numeric", month: "long" })}
        onAvatar={onAvatar}
      />

      {/* Tâches du jour — RÉELLES */}
      <Card>
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium text-muted">Aujourd&apos;hui</h2>
          <button onClick={() => go("planning")} className="-my-3 -mr-2 min-h-11 px-2 text-xs text-brass">
            Tout voir
          </button>
        </div>
        <p className="mt-1 font-serif text-[22px] leading-snug">{summary}</p>
        {api.error && <p className="mt-2 text-sm text-[#d99a86]">{api.error}</p>}
        {focus.length > 0 && (
          <ul className="mt-2 divide-y divide-line/60">
            {focus.slice(0, 5).map((t) => (
              <TaskRow key={t.id} t={t} done={t.status === "done" || api.leaving.has(t.id)} onToggle={() => api.toggle(t)} />
            ))}
          </ul>
        )}
        {focus.length > 5 && <p className="pt-1 text-xs text-faint">+ {focus.length - 5} autres dans le Planning</p>}
      </Card>

      {/* Prochain RDV — FICTIF */}
      {next && (
        <Card onClick={() => go("planning")}>
          <DemoBanner phase={DEMO_PHASE.agenda} what="agenda fictif" />
          <div className="mt-3 flex items-center gap-4">
            <div className="flex size-12 shrink-0 flex-col items-center justify-center rounded-2xl bg-raised">
              <span className="text-[10px] uppercase text-faint">{new Date(next.start).toLocaleDateString("fr-FR", { weekday: "short" })}</span>
              <span className="text-sm font-semibold tabular-nums">{hhmm(next.start)}</span>
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted">Prochain rendez-vous</p>
              <p className="truncate text-[16px] font-medium">{next.title}</p>
              {next.place && <p className="truncate text-xs text-faint">{next.place}</p>}
            </div>
          </div>
        </Card>
      )}

      {/* Aperçus Finances et Forme — FICTIFS */}
      <div className="grid grid-cols-2 gap-3">
        <Card onClick={() => go("finances")} className="p-4">
          <DemoBanner phase={DEMO_PHASE.finances} what="fictif" />
          <p className="mt-3 text-xs text-muted">Solde</p>
          <p className="text-[22px] font-semibold tabular-nums tracking-tight">{euro(f.balance, false)}</p>
          <p className="mb-2 mt-1 text-xs text-faint">{euro(f.monthSpent, false)} dépensés ce mois</p>
          <Bar value={f.monthSpent} max={f.monthBudget} />
        </Card>
        <Card onClick={() => go("forme")} className="p-4">
          <DemoBanner phase={DEMO_PHASE.forme} what="fictif" />
          <p className="mt-3 text-xs text-muted">Sommeil</p>
          <p className="text-[22px] font-semibold tabular-nums tracking-tight">
            {Math.floor(s.sleep.hours)} h {String(Math.round((s.sleep.hours % 1) * 60)).padStart(2, "0")}
          </p>
          <p className="mb-2 mt-1 text-xs text-faint">{s.steps.count.toLocaleString("fr-FR")} pas aujourd&apos;hui</p>
          <Bar value={s.steps.count} max={s.steps.goal} />
        </Card>
      </div>
    </div>
  );
}
