"use client";

import { useRef, useState } from "react";
import { DEMO_PHASE, demoEvents, type DemoEvent } from "@/lib/demo-data";
import { dotsFor, hourRange, parisHM, planDay, swipeDirection, weekOf } from "@/lib/planning";
import { addDays, dayLabel, parisDay } from "@/lib/task-groups";
import TaskSheet from "./task-sheet";
import { DemoBanner, Header, hhmm, SkeletonRows } from "./ui";
import type { Task, TasksApi } from "./use-tasks";

const LETTERS = ["L", "M", "M", "J", "V", "S", "D"];
const longDate = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("fr-FR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });
const num = (day: string) => Number(day.slice(8));
const chevron = (d: string) => (
  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
    <path d={d} />
  </svg>
);

/** Une tâche du jour : la case ronde coche, le reste ouvre la fiche. Chaque zone fait au moins 44 px de haut. */
function PlanRow({ t, done, time, onToggle, onOpen }: { t: Task; done: boolean; time?: string; onToggle: () => void; onOpen: () => void }) {
  return (
    <li className="rise flex items-center">
      <button onClick={onToggle} disabled={t.id < 0} aria-pressed={done} aria-label={done ? `Rouvrir : ${t.title}` : `Terminer : ${t.title}`} className="-ml-3 flex size-11 shrink-0 items-center justify-center">
        <span className={`flex size-5 items-center justify-center rounded-full border transition-all duration-300 ${done ? "scale-110 border-accent bg-accent text-ink" : "border-faint"}`}>
          {done && (
            <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
              <path d="M5 12l5 5 9-10" />
            </svg>
          )}
        </span>
      </button>
      <button onClick={onOpen} disabled={t.id < 0} className={`flex min-h-11 min-w-0 flex-1 items-center gap-2 pr-1 text-left text-[15px] leading-snug transition-opacity duration-300 ${done ? "text-faint line-through opacity-60" : ""}`}>
        {t.priority === 1 && !done && <span className="size-1.5 shrink-0 rounded-full bg-accent" title="Priorité haute" />}
        <span className={`min-w-0 flex-1 ${t.priority === 3 && !done ? "text-muted" : ""}`}>{t.title}</span>
        {time ? <span className="shrink-0 text-xs tabular-nums text-faint">{time}</span> : null}
      </button>
    </li>
  );
}

/** Un RDV FICTIF : marqué « fictif » pour ne jamais le confondre avec le réel. */
function EventRow({ e }: { e: DemoEvent }) {
  return (
    <li className="flex min-h-11 items-center gap-2 text-[15px] text-fg/80">
      <span className="h-4 w-0.5 shrink-0 rounded-full bg-accent/50" aria-hidden />
      <span className="min-w-0 flex-1 truncate">{e.title}</span>
      <span className="shrink-0 text-xs tabular-nums text-faint">
        {hhmm(e.start)}–{hhmm(e.end)}
      </span>
      <span className="shrink-0 rounded-full border border-line px-1.5 text-[10px] uppercase tracking-wider text-faint">fictif</span>
    </li>
  );
}

export default function PlanningView({ tasks: api, onAvatar }: { tasks: TasksApi; onAvatar: () => void }) {
  const now = new Date();
  const today = parisDay(now);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState(2);
  const [showOptions, setShowOptions] = useState(false);
  const [day, setDay] = useState(today);
  const [openId, setOpenId] = useState<number | null>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);

  function add() {
    const clean = title.trim();
    if (!clean) return;
    api.add(clean, due ? new Date(due).toISOString() : null, priority);
    setTitle("");
    setDue("");
    setPriority(2);
    setShowOptions(false);
  }

  const isDone = (t: Task) => t.status === "done" || api.leaving.has(t.id);
  const plan = planDay(api.tasks, day, now);
  const events = demoEvents().filter((e) => parisDay(new Date(e.start)) === day && new Date(e.end) > now);
  const eventsByHour = new Map<number, DemoEvent[]>();
  for (const e of events) eventsByHour.set(parisHM(e.start).h, [...(eventsByHour.get(parisHM(e.start).h) ?? []), e]);
  const nowHM = day === today ? parisHM(now.toISOString()) : null;
  const { start, end } = hourRange([...plan.byHour.keys(), ...eventsByHour.keys()], nowHM);
  // Heures vides qui se suivent : regroupées en une seule ligne fine (« 07–12 h »), pour ne pas allonger l'écran.
  const isBusy = (h: number) => plan.byHour.has(h) || eventsByHour.has(h) || nowHM?.h === h;
  const rows: ({ h: number } | { from: number; to: number })[] = [];
  for (let h = start; h <= end; h++) {
    let to = h;
    while (!isBusy(h) && to + 1 <= end && !isBusy(to + 1)) to++;
    if (to > h) {
      rows.push({ from: h, to });
      h = to;
    } else rows.push({ h });
  }
  const top = [...plan.late, ...plan.allDay, ...plan.undated];
  const empty = api.loaded && !top.length && !plan.byHour.size && !events.length;
  const opened = openId !== null ? api.tasks.find((t) => t.id === openId) : undefined;

  const row = (t: Task, time?: string) => <PlanRow key={t.id} t={t} done={isDone(t)} time={time} onToggle={() => api.toggle(t)} onOpen={() => setOpenId(t.id)} />;

  return (
    <div className="pb-6">
      <div className="px-4">
        <Header title="Planning" onAvatar={onAvatar} />
        {/* Ajout rapide : sans IA, gratuit et instantané */}
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
            className={`flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface ${showOptions || due ? "text-accent" : "text-muted"}`}
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
            <input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Échéance" className="h-12 min-w-0 flex-1 rounded-2xl bg-surface px-3 text-sm text-muted outline-none [color-scheme:dark] focus:ring-1 focus:ring-accent/50" />
            <select value={priority} onChange={(e) => setPriority(Number(e.target.value))} aria-label="Priorité" className="h-12 rounded-2xl bg-surface px-3 text-sm text-muted outline-none focus:ring-1 focus:ring-accent/50">
              <option value={1}>Haute</option>
              <option value={2}>Normale</option>
              <option value={3}>Basse</option>
            </select>
          </div>
        )}
      </div>

      {/* Semaine en mini-points : un point par tâche à faire (3 au plus) */}
      <nav className="mt-4 grid grid-cols-7 px-2" aria-label="Semaine">
        {weekOf(day).map((d, i) => {
          const n = dotsFor(api.tasks, d);
          const selected = d === day;
          return (
            <button key={d} onClick={() => setDay(d)} aria-current={selected ? "date" : undefined} aria-label={`${longDate(d)}${n ? `, ${n >= 3 ? "3 tâches ou plus" : `${n} tâche${n > 1 ? "s" : ""}`}` : ""}`} className="flex min-h-14 flex-col items-center justify-center gap-0.5">
              <span className="text-[11px] text-muted">{LETTERS[i]}</span>
              <span className={`flex size-8 items-center justify-center rounded-full text-[14px] tabular-nums ${selected ? "bg-accent font-semibold text-ink" : d === today ? "text-accent ring-1 ring-accent/60" : "text-fg"}`}>{num(d)}</span>
              <span className="flex h-1.5 gap-0.5" aria-hidden>
                {Array.from({ length: n }, (_, k) => (
                  <span key={k} className="size-1 rounded-full bg-accent" />
                ))}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Jour affiché + navigation (glisser à gauche / à droite fait pareil) */}
      <div className="flex items-center gap-1 px-3 pt-3">
        <button onClick={() => setDay(addDays(day, -1))} aria-label="Jour précédent" className="flex size-11 items-center justify-center rounded-full text-muted active:bg-raised">
          {chevron("M15 6l-6 6 6 6")}
        </button>
        <div className="min-w-0 flex-1 text-center">
          <h2 className="text-[17px] font-semibold tracking-tight first-letter:uppercase">{dayLabel(day, now) === "Aujourd'hui" || dayLabel(day, now) === "Demain" ? dayLabel(day, now) : new Date(`${day}T12:00:00Z`).toLocaleDateString("fr-FR", { timeZone: "UTC", weekday: "long" })}</h2>
          <p className="text-[12px] text-muted">{new Date(`${day}T12:00:00Z`).toLocaleDateString("fr-FR", { timeZone: "UTC", day: "numeric", month: "long" })}</p>
        </div>
        {day !== today ? (
          <button onClick={() => setDay(today)} className="min-h-11 rounded-full px-3 text-[13px] font-medium text-accent active:bg-raised">
            Aujourd&apos;hui
          </button>
        ) : (
          <span className="w-11" aria-hidden />
        )}
        <button onClick={() => setDay(addDays(day, 1))} aria-label="Jour suivant" className="flex size-11 items-center justify-center rounded-full text-muted active:bg-raised">
          {chevron("M9 6l6 6-6 6")}
        </button>
      </div>

      <div
        key={day}
        className="rise px-5 pt-2"
        onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
        onTouchEnd={(e) => {
          const s = touch.current;
          touch.current = null;
          if (!s) return;
          const dir = swipeDirection(e.changedTouches[0].clientX - s.x, e.changedTouches[0].clientY - s.y);
          if (dir) setDay(addDays(day, dir));
        }}
      >
        <div className="pb-1">
          <DemoBanner phase={DEMO_PHASE.agenda} what="rendez-vous fictifs" />
        </div>
        {api.error && <p className="pt-2 text-sm text-neg">{api.error}</p>}
        {!api.loaded && (
          <div className="pt-4">
            <SkeletonRows rows={4} />
          </div>
        )}

        {plan.late.length > 0 && (
          <section className="pt-4" aria-label="En retard">
            <h3 className="text-[11px] uppercase tracking-[0.14em] text-accent">En retard</h3>
            <ul className="divide-y divide-line/60">{plan.late.map((t) => row(t))}</ul>
          </section>
        )}
        {(plan.allDay.length > 0 || plan.undated.length > 0) && (
          <section className="pt-4" aria-label="Sans heure">
            <h3 className="text-[11px] uppercase tracking-[0.14em] text-muted">Sans heure</h3>
            <ul className="divide-y divide-line/60">{[...plan.allDay, ...plan.undated].map((t) => row(t))}</ul>
          </section>
        )}

        {/* Frise des heures : une ligne par heure, les tâches posées dessus */}
        {api.loaded && !empty && (
          <ol className="relative mt-4" aria-label="Heures">
            {rows.map((r) => {
              if ("from" in r) {
                return (
                  <li key={`gap${r.from}`} className="flex min-h-9">
                    <span className="w-12 shrink-0 pt-3 text-xs tabular-nums text-faint">
                      {String(r.from).padStart(2, "0")}–{String(r.to).padStart(2, "0")} h
                    </span>
                    <div className="min-w-0 flex-1 border-l border-line" />
                  </li>
                );
              }
              const h = r.h;
              const items = plan.byHour.get(h) ?? [];
              const evs = eventsByHour.get(h) ?? [];
              const busy = items.length > 0 || evs.length > 0;
              return (
                <li key={h} className={`relative flex ${busy ? "" : "min-h-9"}`}>
                  <span className={`w-12 shrink-0 pt-3 text-xs tabular-nums ${nowHM?.h === h ? "font-semibold text-accent" : busy ? "text-muted" : "text-faint"}`}>{String(h).padStart(2, "0")}:00</span>
                  <div className="min-w-0 flex-1 border-l border-line pl-3">
                    {busy && (
                      <ul className="divide-y divide-line/60 py-0.5">
                        {items.map((t) => row(t, parisHM(t.due_at!).m ? hhmm(t.due_at!) : undefined))}
                        {evs.map((e) => (
                          <EventRow key={e.id} e={e} />
                        ))}
                      </ul>
                    )}
                  </div>
                  {nowHM?.h === h && <span className="glow pointer-events-none absolute -left-0.5 h-px bg-accent" style={{ top: `${(nowHM.m / 60) * 100}%`, left: "3rem", right: 0 }} aria-hidden />}
                </li>
              );
            })}
          </ol>
        )}
        {empty && <p className="pt-10 text-center text-[15px] text-muted">Rien de prévu ce jour.</p>}
      </div>

      {opened && <TaskSheet key={opened.id} t={opened} api={api} onClose={() => setOpenId(null)} />}
    </div>
  );
}
