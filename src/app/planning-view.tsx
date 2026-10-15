"use client";

import { useState } from "react";
import { DEMO_PHASE, demoEvents, type DemoEvent } from "@/lib/demo-data";
import { dayLabel, groupOf, parisDay } from "@/lib/task-groups";
import TaskRow from "./task-row";
import { DemoBanner, Header, hhmm } from "./ui";
import type { Task, TasksApi } from "./use-tasks";

type Item = { kind: "task"; at: string; t: Task } | { kind: "event"; at: string; e: DemoEvent };

/** Un RDV FICTIF dans la timeline : marqué « fictif » pour ne jamais le confondre avec le réel. */
function EventRow({ e }: { e: DemoEvent }) {
  return (
    <li className="flex items-start gap-3 py-2.5">
      <span className="w-11 shrink-0 pt-0.5 text-xs tabular-nums text-faint">{hhmm(e.start)}</span>
      <span className="mt-1 h-4 w-0.5 shrink-0 rounded-full bg-accent/50" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-[15px] text-fg/80">{e.title}</span>
          <span className="shrink-0 rounded-full border border-line px-1.5 text-[10px] uppercase tracking-wider text-faint">fictif</span>
        </span>
        <span className="mt-0.5 block text-xs text-faint">
          jusqu&apos;à {hhmm(e.end)}
          {e.place ? ` · ${e.place}` : ""}
        </span>
      </span>
    </li>
  );
}

export default function PlanningView({ tasks: api, onAvatar }: { tasks: TasksApi; onAvatar: () => void }) {
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState(2);
  const [showOptions, setShowOptions] = useState(false);

  function add() {
    const clean = title.trim();
    if (!clean) return;
    api.add(clean, due ? new Date(due).toISOString() : null, priority);
    setTitle("");
    setDue("");
    setPriority(2);
    setShowOptions(false);
  }

  const now = new Date();
  const isDone = (t: Task) => t.status === "done" && !api.leaving.has(t.id);
  const todo = api.tasks.filter((t) => !isDone(t));
  const late = todo.filter((t) => groupOf(t.due_at, now) === "En retard");
  const undated = todo.filter((t) => !t.due_at);
  const done = api.tasks.filter(isDone);

  // Timeline par jour : tâches datées à venir + RDV, triés par heure.
  const days = new Map<string, Item[]>();
  const push = (at: string, item: Item) => {
    const key = parisDay(new Date(at));
    days.set(key, [...(days.get(key) ?? []), item]);
  };
  todo.filter((t) => t.due_at && !late.includes(t)).forEach((t) => push(t.due_at!, { kind: "task", at: t.due_at!, t }));
  demoEvents()
    .filter((e) => new Date(e.end) > now)
    .forEach((e) => push(e.start, { kind: "event", at: e.start, e }));
  const timeline = [...days.entries()].sort(([a], [b]) => a.localeCompare(b));

  const row = (t: Task, time = false) => <TaskRow key={t.id} t={t} time={time} done={t.status === "done" || api.leaving.has(t.id)} onToggle={() => api.toggle(t)} />;
  const section = (label: string, children: React.ReactNode, accent = false) => (
    <div key={label} className="pt-6">
      <h2 className={`mb-1 text-[11px] uppercase tracking-[0.14em] first-letter:uppercase ${accent ? "text-accent" : "text-faint"}`}>{label}</h2>
      <ul className="divide-y divide-line/60">{children}</ul>
    </div>
  );

  return (
    <div className="pb-6">
      {/* Ajout rapide : sans IA, gratuit et instantané */}
      <div className="px-4">
        <Header title="Planning" subtitle="Tâches et rendez-vous" onAvatar={onAvatar} />
        <div className="flex gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Nouvelle tâche…"
            aria-label="Nouvelle tâche"
            className="h-12 min-w-0 flex-1 rounded-2xl bg-surface px-4 text-[15px] outline-none placeholder:text-faint focus:ring-1 focus:ring-accent/50"
          />
          <button
            onClick={() => setShowOptions((v) => !v)}
            aria-label="Date et priorité"
            aria-expanded={showOptions}
            className={`flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface ${showOptions || due ? "text-accent" : "text-faint"}`}
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
              <rect x="4" y="5" width="16" height="15" rx="2" />
              <path d="M4 10h16M9 3v4M15 3v4" />
            </svg>
          </button>
          <button onClick={add} disabled={!title.trim()} aria-label="Ajouter" className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-ink disabled:opacity-25">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
        {showOptions && (
          <div className="rise mt-2 flex gap-2">
            <input
              type="datetime-local"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              aria-label="Échéance"
              className="h-12 min-w-0 flex-1 rounded-2xl bg-surface px-3 text-sm text-muted outline-none [color-scheme:dark] focus:ring-1 focus:ring-accent/50"
            />
            <select
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
              aria-label="Priorité"
              className="h-12 rounded-2xl bg-surface px-3 text-sm text-muted outline-none focus:ring-1 focus:ring-accent/50"
            >
              <option value={1}>Haute</option>
              <option value={2}>Normale</option>
              <option value={3}>Basse</option>
            </select>
          </div>
        )}
      </div>

      <div className="px-5">
        <div className="pt-5">
          <DemoBanner phase={DEMO_PHASE.agenda} what="rendez-vous fictifs, tâches réelles" />
        </div>
        {api.error && <p className="pt-3 text-sm text-neg">{api.error}</p>}
        {late.length > 0 && section("En retard", late.map((t) => row(t)), true)}
        {timeline.map(([day, items]) =>
          section(
            dayLabel(day, now),
            items.sort((a, b) => a.at.localeCompare(b.at)).map((it) => (it.kind === "task" ? row(it.t, true) : <EventRow key={it.e.id} e={it.e} />)),
          ),
        )}
        {undated.length > 0 && section("Sans date", undated.map((t) => row(t)))}
        {done.length > 0 && section("Terminées récemment", done.map((t) => row(t)))}
      </div>
    </div>
  );
}
