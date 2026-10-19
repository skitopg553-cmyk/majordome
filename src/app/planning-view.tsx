"use client";

import { useRef, useState } from "react";
import type { AgendaEvent } from "@/lib/google-api";
import { dotsFor, hourRange, parisHM, planDay, weekOf } from "@/lib/planning";
import { occurrencesOn, type Occurrence } from "@/lib/slots";
import { addDays, parisDay } from "@/lib/task-groups";
import DayPager, { type PagerHandle } from "./day-pager";
import EventSheet from "./event-sheet";
import SlotSheet from "./slot-sheet";
import TaskSheet from "./task-sheet";
import { Header, hhmm, SkeletonRows } from "./ui";
import type { GoogleApi } from "./use-google";
import type { SlotsApi } from "./use-slots";
import type { Task, TasksApi } from "./use-tasks";

const LETTERS = ["L", "M", "M", "J", "V", "S", "D"];
/** « Sam. 17 oct. » : la vraie date, jamais « Demain » ni « Aujourd'hui ». */
const headerDate = (day: string) => {
  const t = new Date(`${day}T12:00:00Z`).toLocaleDateString("fr-FR", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
  return t.charAt(0).toUpperCase() + t.slice(1);
};
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
        <span className={`line-clamp-2 min-w-0 flex-1 break-words ${t.priority === 3 && !done ? "text-muted" : ""}`}>{t.title}</span>
        {time ? <span className="shrink-0 text-xs tabular-nums text-faint">{time}</span> : null}
      </button>
    </li>
  );
}

/** Une ligne de la frise qui n'est pas une tâche : un rendez-vous Google (lecture seule) ou une occurrence d'un créneau qui revient. Toucher la ligne ouvre sa fiche. */
type Entry = { id: string; title: string; start: string; end: string | null; open: () => void };
function EntryRow({ e }: { e: Entry }) {
  return (
    <li>
      <button onClick={e.open} className="flex min-h-11 w-full items-center gap-2 text-left text-[15px] text-fg/80">
        <span className="h-4 w-0.5 shrink-0 rounded-full bg-accent/50" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{e.title}</span>
        <span className="shrink-0 text-xs tabular-nums text-faint">{e.end ? `${hhmm(e.start)}–${hhmm(e.end)}` : hhmm(e.start)}</span>
      </button>
    </li>
  );
}

export default function PlanningView({ tasks: api, google, slots, accessCode, onUnauthorized, onAvatar }: { tasks: TasksApi; google: GoogleApi; slots: SlotsApi; accessCode: string; onUnauthorized: () => void; onAvatar: () => void }) {
  const real = google.state === "ok"; // sans Google : seulement les éléments de Majordome avec une heure
  const now = new Date();
  const today = parisDay(now);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState(2);
  const [showOptions, setShowOptions] = useState(true); // un événement a toujours une date et une heure
  const [day, setDay] = useState(today);
  const [openId, setOpenId] = useState<number | null>(null);
  const [openEvent, setOpenEvent] = useState<AgendaEvent | null>(null);
  const [openOcc, setOpenOcc] = useState<Occurrence | null>(null);
  const pager = useRef<PagerHandle>(null);

  function add() {
    const clean = title.trim();
    if (!clean || !due) return; // sans heure, ce serait une tâche : elle se crée sur l'Accueil
    api.add(clean, new Date(due).toISOString(), priority);
    setTitle("");
    setDue("");
    setPriority(2);
  }

  const isDone = (t: Task) => t.status === "done" || api.leaving.has(t.id);
  const opened = openId !== null ? api.tasks.find((t) => t.id === openId) : undefined;
  const row = (t: Task, time?: string) => <PlanRow key={t.id} t={t} done={isDone(t)} time={time} onToggle={() => api.toggle(t)} onOpen={() => setOpenId(t.id)} />;

  // Une colonne pour le jour d : la frise des heures (agenda seulement). Le pager en affiche trois : précédent, courant, suivant.
  const dayPanel = (d: string) => {
    const byHour = planDay(api.tasks, d);
    const g = real ? google.events.filter((e) => !e.allDay && parisDay(new Date(e.start)) === d) : [];
    // Créneaux qui reviennent : calculés ici pour ce jour (les semaines futures se voient tout de suite), jamais copiés dans les tâches.
    const events: Entry[] = [
      ...g.map((e) => ({ id: e.id, title: e.title, start: e.start, end: e.end, open: () => setOpenEvent(e) })),
      ...occurrencesOn(slots.rules, slots.exceptions, d).map((o) => ({ id: o.key, title: o.title, start: o.start, end: o.end, open: () => setOpenOcc(o) })),
    ].sort((a, b) => a.start.localeCompare(b.start));
    // « Toute la journée » (jours fériés, anniversaires…) : une petite ligne au-dessus de la frise, un événement de plusieurs jours est sur chacun de ses jours.
    const allDay = real ? google.events.filter((e) => e.allDay && parisDay(new Date(e.start)) <= d && d < parisDay(new Date(e.end))) : [];
    const eventsByHour = new Map<number, Entry[]>();
    for (const e of events) eventsByHour.set(parisHM(e.start).h, [...(eventsByHour.get(parisHM(e.start).h) ?? []), e]);
    const nowHM = d === today ? parisHM(now.toISOString()) : null;
    const { start, end } = hourRange([...byHour.keys(), ...eventsByHour.keys()], nowHM);
    // Heures vides qui se suivent : regroupées en une seule ligne fine (« 07–12 h »), pour ne pas allonger l'écran.
    const isBusy = (h: number) => byHour.has(h) || eventsByHour.has(h) || nowHM?.h === h;
    const rows: ({ h: number } | { from: number; to: number })[] = [];
    for (let h = start; h <= end; h++) {
      let to = h;
      while (!isBusy(h) && to + 1 <= end && !isBusy(to + 1)) to++;
      if (to > h) {
        rows.push({ from: h, to });
        h = to;
      } else rows.push({ h });
    }
    const empty = api.loaded && !byHour.size && !events.length && !allDay.length;
    return (
      <div className="pt-2">
        {allDay.length > 0 && (
          <ul className="flex flex-wrap gap-1.5 pt-2" aria-label="Toute la journée">
            {allDay.map((e) => (
              <li key={e.id}>
                <button onClick={() => setOpenEvent(e)} className="min-h-8 rounded-full bg-surface px-3 py-1 text-[12px] text-muted active:bg-raised">
                  {e.title}
                </button>
              </li>
            ))}
          </ul>
        )}
        {api.error && <p className="pt-2 text-sm text-neg">{api.error}</p>}
        {!api.loaded && (
          <div className="pt-4">
            <SkeletonRows rows={4} />
          </div>
        )}
        {/* Frise des heures : une ligne par heure, l'agenda posé dessus */}
        {api.loaded && !empty && (
          <ol className="relative mt-4" aria-label="Heures">
            {rows.map((r) => {
              if ("from" in r) {
                return (
                  <li key={`gap${r.from}`} className="flex min-h-9">
                    <span className="w-14 shrink-0 whitespace-nowrap pt-3 text-xs tabular-nums text-faint">
                      {String(r.from).padStart(2, "0")}–{String(r.to).padStart(2, "0")} h
                    </span>
                    <div className="min-w-0 flex-1 border-l border-line" />
                  </li>
                );
              }
              const h = r.h;
              const items = byHour.get(h) ?? [];
              const evs = eventsByHour.get(h) ?? [];
              const busy = items.length > 0 || evs.length > 0;
              return (
                <li key={h} className={`relative flex ${busy ? "" : "min-h-9"}`}>
                  <span className={`w-14 shrink-0 whitespace-nowrap pt-3 text-xs tabular-nums ${nowHM?.h === h ? "font-semibold text-accent" : busy ? "text-muted" : "text-faint"}`}>{String(h).padStart(2, "0")}:00</span>
                  <div className="min-w-0 flex-1 border-l border-line pl-3">
                    {busy && (
                      <ul className="divide-y divide-line/60 py-0.5">
                        {items.map((t) => row(t, t.end_at ? `${hhmm(t.due_at!)}–${hhmm(t.end_at)}` : parisHM(t.due_at!).m ? hhmm(t.due_at!) : undefined))}
                        {evs.map((e) => (
                          <EntryRow key={e.id} e={e} />
                        ))}
                      </ul>
                    )}
                  </div>
                  {nowHM?.h === h && <span className="glow pointer-events-none absolute h-px bg-accent" style={{ top: `${(nowHM.m / 60) * 100}%`, left: "3.5rem", right: 0 }} aria-hidden />}
                </li>
              );
            })}
          </ol>
        )}
        {empty && <p className="pt-10 text-center text-[15px] text-muted">Rien de prévu ce jour.</p>}
      </div>
    );
  };

  return (
    <div className="pb-6">
      <div className="px-4">
        <Header title="Planning" onAvatar={onAvatar} />
        {/* Ajout rapide d'un événement : sans IA, gratuit et instantané */}
        <div className="flex gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Nouvel événement…"
            aria-label="Nouvel événement"
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
          <button onClick={add} disabled={!title.trim() || !due} aria-label="Ajouter à l'agenda" className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-ink disabled:opacity-25">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
        {showOptions && (
          <div className="rise mt-2 flex gap-2">
            <input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Date et heure" className="h-12 min-w-0 flex-1 rounded-2xl bg-surface px-3 text-sm text-muted outline-none [color-scheme:dark] focus:ring-1 focus:ring-accent/50" />
            <select value={priority} onChange={(e) => setPriority(Number(e.target.value))} aria-label="Priorité" className="h-12 rounded-2xl bg-surface px-3 text-sm text-muted outline-none focus:ring-1 focus:ring-accent/50">
              <option value={1}>Haute</option>
              <option value={2}>Normale</option>
              <option value={3}>Basse</option>
            </select>
          </div>
        )}
      </div>

      {/* Semaine en mini-points : un point par élément d'agenda (3 au plus) ; un point accent au-dessus de la lettre marque aujourd'hui */}
      <nav className="mt-4 grid grid-cols-7 px-2" aria-label="Semaine">
        {weekOf(day).map((d, i) => {
          const n = Math.min(3, dotsFor(api.tasks, d) + occurrencesOn(slots.rules, slots.exceptions, d).length);
          const selected = d === day;
          return (
            <button
              key={d}
              onClick={() => pager.current?.goTo(d)}
              aria-current={d === today ? "date" : undefined}
              aria-pressed={selected}
              aria-label={`${longDate(d)}${d === today ? " (aujourd'hui)" : ""}${n ? `, ${n >= 3 ? "3 événements ou plus" : `${n} événement${n > 1 ? "s" : ""}`}` : ""}`}
              className="flex min-h-14 flex-col items-center justify-center gap-0.5"
            >
              <span className={`size-1 rounded-full ${d === today ? "bg-accent" : ""}`} aria-hidden />
              <span className="text-[11px] text-muted">{LETTERS[i]}</span>
              <span className={`flex size-8 items-center justify-center rounded-full text-[14px] tabular-nums ${selected ? "bg-accent font-semibold text-ink" : "text-fg"}`}>{num(d)}</span>
              <span className="flex h-1.5 gap-0.5" aria-hidden>
                {Array.from({ length: n }, (_, k) => (
                  <span key={k} className="size-1 rounded-full bg-muted" />
                ))}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Date réelle + flèches ; hors d'aujourd'hui, toucher la date ramène à aujourd'hui */}
      <div className="flex items-center gap-1 px-3 pt-3">
        <button onClick={() => pager.current?.goTo(addDays(day, -1))} aria-label="Jour précédent" className="flex size-11 items-center justify-center rounded-full text-muted active:bg-raised">
          {chevron("M15 6l-6 6 6 6")}
        </button>
        {day === today ? (
          <h2 className="min-w-0 flex-1 text-center text-[17px] font-semibold tracking-tight">{headerDate(day)}</h2>
        ) : (
          <button onClick={() => pager.current?.goTo(today)} aria-label={`${longDate(day)} : revenir à aujourd'hui`} className="min-h-11 min-w-0 flex-1 text-center text-[17px] font-semibold tracking-tight">
            {headerDate(day)}
          </button>
        )}
        <button onClick={() => pager.current?.goTo(addDays(day, 1))} aria-label="Jour suivant" className="flex size-11 items-center justify-center rounded-full text-muted active:bg-raised">
          {chevron("M9 6l6 6-6 6")}
        </button>
      </div>

      <DayPager ref={pager} day={day} onDay={setDay} render={dayPanel} />

      {openOcc && <SlotSheet key={openOcc.key} o={openOcc} slots={slots} accessCode={accessCode} onUnauthorized={onUnauthorized} onClose={() => setOpenOcc(null)} />}
      {openEvent && <EventSheet e={openEvent} onClose={() => setOpenEvent(null)} />}
      {opened && <TaskSheet key={opened.id} t={opened} api={api} onClose={() => setOpenId(null)} />}
    </div>
  );
}
