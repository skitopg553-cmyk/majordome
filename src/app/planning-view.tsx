"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { eventsOn, fromMin, hmOf, layoutDay, remindersFor, toMin, type CalEvent } from "@/lib/calendar";
import type { AgendaEvent } from "@/lib/google-api";
import { weekOf } from "@/lib/planning";
import { addDays, parisDay } from "@/lib/task-groups";
import EventEditor, { type EditorTarget } from "./event-editor";
import EventSheet from "./event-sheet";
import TaskRow from "./task-row";
import TaskSheet from "./task-sheet";
import { Header } from "./ui";
import type { GoogleApi } from "./use-google";
import type { SlotsApi } from "./use-slots";
import type { TasksApi } from "./use-tasks";

const H = 48; // hauteur d'une heure dans la grille, en pixels
const LETTERS = ["L", "M", "M", "J", "V", "S", "D"];
const headerDate = (day: string) => {
  const t = new Date(`${day}T12:00:00Z`).toLocaleDateString("fr-FR", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const longDate = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("fr-FR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });
const chevron = (d: string) => (
  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
    <path d={d} />
  </svg>
);
const nowMin = () => toMin(hmOf(new Date().toISOString()));

/** Un pavé : sa hauteur = sa durée. Toucher = sa fiche. */
function Block({ e, col, cols, compact, onOpen }: { e: CalEvent; col: number; cols: number; compact: boolean; onOpen: () => void }) {
  const top = (toMin(e.start) / 60) * H;
  const height = Math.max(((toMin(e.end) - toMin(e.start)) / 60) * H - 2, compact ? 16 : 22);
  const tone = e.source === "google" ? "bg-raised ring-1 ring-line text-fg/90" : e.recurring ? "bg-accent/15 text-fg" : "bg-accent/30 text-fg";
  const showTimes = !compact && height >= 36;
  const lines = Math.max(1, Math.floor((height - 4 - (showTimes ? 15 : 0)) / (compact ? 13 : 16))); // autant de lignes de titre que la hauteur le permet
  const narrow = compact && cols > 1; // pavés côte à côte dans une colonne de semaine : trop étroits pour du texte lisible
  return (
    <button
      onClick={(ev) => {
        ev.stopPropagation();
        onOpen();
      }}
      aria-label={`${e.title}, ${e.start} à ${e.end}`}
      className={`absolute flex flex-col items-start justify-start overflow-hidden rounded-lg border-l-2 border-accent text-left active:brightness-125 ${compact ? "px-0.5 py-0.5" : "px-1.5 py-1"} ${tone}`}
      style={{ top, height, left: `calc(${(col / cols) * 100}% + 1px)`, width: `calc(${100 / cols}% - 2px)` }}
    >
      {!narrow && (
        <span className={`w-full overflow-hidden font-semibold leading-tight ${compact ? "text-[10px] [word-break:keep-all]" : "text-[13px] break-words"}`} style={{ display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: lines }}>
          {e.title}
        </span>
      )}
      {showTimes && <span className="text-[11px] tabular-nums text-fg/70">{`${e.start}–${e.end}`}</span>}
    </button>
  );
}

/** Une colonne de jour : lignes des heures, pavés côte à côte s'ils se chevauchent, ligne de l'heure actuelle. Toucher un vide = créer à cette heure. */
function DayColumn({ day, events, today, compact, onCreate, onOpen }: { day: string; events: CalEvent[]; today: string; compact: boolean; onCreate: (start: string) => void; onOpen: (e: CalEvent) => void }) {
  const layout = useMemo(() => layoutDay(events), [events]);
  return (
    <div
      className="relative h-full min-w-0 flex-1 border-l border-line/70"
      onClick={(e) => {
        const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
        onCreate(fromMin(Math.min(Math.floor(((y / H) * 60) / 30) * 30, 23 * 60)));
      }}
      data-day={day}
    >
      {Array.from({ length: 24 }, (_, h) => (
        <div key={h} className="absolute inset-x-0 border-t border-line/50" style={{ top: h * H }} aria-hidden />
      ))}
      {events.map((e) => {
        const l = layout.get(e.key) ?? { col: 0, cols: 1 };
        return <Block key={e.key} e={e} col={l.col} cols={l.cols} compact={compact} onOpen={() => onOpen(e)} />;
      })}
      {day === today && <div className="glow pointer-events-none absolute inset-x-0 h-0.5 bg-accent" style={{ top: (nowMin() / 60) * H }} aria-hidden />}
    </div>
  );
}

export default function PlanningView({ tasks: api, google, slots, accessCode, onUnauthorized, onAvatar }: { tasks: TasksApi; google: GoogleApi; slots: SlotsApi; accessCode: string; onUnauthorized: () => void; onAvatar: () => void }) {
  const today = parisDay(new Date());
  const [day, setDay] = useState(today);
  const [view, setView] = useState<"day" | "week">("day");
  const [editor, setEditor] = useState<EditorTarget | null>(null);
  const [openGoogle, setOpenGoogle] = useState<AgendaEvent | null>(null);
  const [openTask, setOpenTask] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [newReminder, setNewReminder] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const real = google.state === "ok";

  const days = view === "day" ? [day] : weekOf(day);
  const eventsFor = (d: string): CalEvent[] => [
    ...eventsOn(d, api.tasks, slots.rules, slots.exceptions),
    ...(real
      ? google.events
          .filter((g) => !g.allDay && parisDay(new Date(g.start)) === d)
          .map((g) => ({ key: `g${g.id}`, source: "google" as const, id: g.id, googleId: g.id, title: g.title, day: d, start: hmOf(g.start), end: parisDay(new Date(g.end)) === d ? hmOf(g.end) : "23:59", recurring: false, habit: false }))
      : []),
  ];
  const allDay = real && view === "day" ? google.events.filter((e) => e.allDay && parisDay(new Date(e.start)) <= day && day < parisDay(new Date(e.end))) : [];
  const reminders = remindersFor(view === "day" ? day : today, api.tasks.map((t) => (api.leaving.has(t.id) ? { ...t, status: "todo" as const } : t)), today);
  const opened = openTask !== null ? api.tasks.find((t) => t.id === openTask) : undefined;

  // À l'ouverture (et au changement de vue) : la grille défile vers l'heure actuelle, ou 7 h.
  useEffect(() => {
    const h = days.includes(today) ? Math.max(0, Math.floor(nowMin() / 60) - 1) : 7;
    scroller.current?.scrollTo({ top: h * H });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const step = (n: number) => setDay((d) => addDays(d, view === "day" ? n : 7 * n));
  const open = (e: CalEvent, shownDay: string) => {
    if (e.source === "google") return setOpenGoogle(google.events.find((g) => g.id === e.googleId) ?? null);
    setEditor({ mode: "edit", event: e, shownDay, rule: e.source === "rule" ? slots.rules.find((r) => r.id === e.id) : undefined });
  };
  function done(msg: string) {
    setEditor(null);
    setNotice(msg);
    api.load();
    slots.reload();
    setTimeout(() => setNotice(null), 4000);
  }
  const title = view === "day" ? headerDate(day) : `Semaine du ${headerDate(weekOf(day)[0])}`;

  return (
    <div className="pb-6">
      <div className="px-4">
        <Header title="Planning" onAvatar={onAvatar} />
        {/* Barre : précédent / date (toucher = revenir à aujourd'hui) / suivant, puis + */}
        <div className="flex items-center gap-1">
          <button onClick={() => step(-1)} aria-label={view === "day" ? "Jour précédent" : "Semaine précédente"} className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted active:bg-raised">
            {chevron("M15 6l-6 6 6 6")}
          </button>
          {day === today ? (
            <h2 className="min-w-0 flex-1 truncate text-center text-[16px] font-semibold tracking-tight">{title}</h2>
          ) : (
            <button onClick={() => setDay(today)} aria-label={`${longDate(day)} : revenir à aujourd'hui`} className="min-h-11 min-w-0 flex-1 truncate text-center text-[16px] font-semibold tracking-tight">
              {title}
            </button>
          )}
          <button onClick={() => step(1)} aria-label={view === "day" ? "Jour suivant" : "Semaine suivante"} className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted active:bg-raised">
            {chevron("M9 6l6 6-6 6")}
          </button>
          <button onClick={() => setEditor({ mode: "create", day, start: fromMin(Math.min((Math.floor(nowMin() / 60) + 1) * 60, 23 * 60)) })} aria-label="Nouvel événement" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-ink active:scale-95">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
        <div className="mt-2 grid grid-cols-2 rounded-full bg-surface p-1" role="tablist" aria-label="Vue">
          {(["day", "week"] as const).map((v) => (
            <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} className={`min-h-11 rounded-full text-[14px] font-semibold ${view === v ? "bg-raised text-fg" : "text-muted"}`}>
              {v === "day" ? "Jour" : "Semaine"}
            </button>
          ))}
        </div>
      </div>

      {/* Les 7 jours : en vue Jour, toucher un jour l'ouvre ; en vue Semaine, ce sont les en-têtes des colonnes */}
      <nav className="mt-2 flex pl-11 pr-2" aria-label="Semaine">
        {weekOf(day).map((d, i) => (
          <button
            key={d}
            onClick={() => {
              setDay(d);
              setView("day");
            }}
            aria-current={d === today ? "date" : undefined}
            aria-pressed={view === "day" && d === day}
            aria-label={longDate(d)}
            className="flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center"
          >
            <span className="text-[11px] text-muted">{LETTERS[i]}</span>
            <span className={`flex size-7 items-center justify-center rounded-full text-[13px] tabular-nums ${view === "day" && d === day ? "bg-accent font-semibold text-ink" : d === today ? "font-semibold text-accent" : "text-fg"}`}>{Number(d.slice(8))}</span>
          </button>
        ))}
      </nav>

      {allDay.length > 0 && (
        <ul className="flex flex-wrap gap-1.5 px-4 pb-1" aria-label="Toute la journée">
          {allDay.map((e) => (
            <li key={e.id}>
              <button onClick={() => setOpenGoogle(e)} className="min-h-8 rounded-full bg-surface px-3 py-1 text-[12px] text-muted active:bg-raised">
                {e.title}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* La grille : 0 h-24 h ; glisser à gauche / à droite change de jour (ou de semaine) */}
      <div
        ref={scroller}
        className="relative h-[58dvh] touch-pan-y overflow-y-auto overscroll-contain border-y border-line/70"
        onPointerDown={(e) => (swipe.current = { x: e.clientX, y: e.clientY })}
        onPointerUp={(e) => {
          const s = swipe.current;
          swipe.current = null;
          if (s && Math.abs(e.clientX - s.x) > 70 && Math.abs(e.clientY - s.y) < 40) step(e.clientX < s.x ? 1 : -1);
        }}
        aria-label="Grille horaire"
      >
        <div className="relative flex pr-2" style={{ height: 24 * H }}>
          <div className="relative w-11 shrink-0" aria-hidden>
            {Array.from({ length: 23 }, (_, i) => (
              <span key={i} className="absolute -translate-y-1/2 pl-1.5 text-[11px] tabular-nums text-faint" style={{ top: (i + 1) * H }}>
                {String(i + 1).padStart(2, "0")}:00
              </span>
            ))}
          </div>
          {days.map((d) => (
            <DayColumn key={d} day={d} events={eventsFor(d)} today={today} compact={view === "week"} onCreate={(start) => setEditor({ mode: "create", day: d, start })} onOpen={(e) => open(e, d)} />
          ))}
        </div>
      </div>
      {notice && (
        <p className="rise mx-4 mt-2 rounded-2xl bg-surface px-4 py-3 text-[13px] text-fg" aria-live="polite">
          {notice}
        </p>
      )}

      {/* Pense-bêtes : à cocher, JAMAIS dans la grille */}
      <section className="mt-3 px-4" aria-label="Pense-bêtes">
        <h3 className="px-1 text-[13px] font-medium text-muted">{view === "day" && day !== today ? `À faire ${longDate(day)}` : "À faire aujourd'hui"}</h3>
        {reminders.length > 0 ? (
          <ul className="mt-1">
            {reminders.map((t) => (
              <TaskRow key={t.id} t={t} leaving={api.leaving.has(t.id)} onToggle={() => api.toggle(t)} onOpen={() => (t.recurring ? api.stopRecurring(t) : setOpenTask(t.id))} />
            ))}
          </ul>
        ) : (
          <p className="px-1 pt-1 text-[14px] text-faint">Rien à cocher.</p>
        )}
        <form
          className="mt-1"
          onSubmit={(e) => {
            e.preventDefault();
            if (!newReminder.trim()) return;
            api.add(newReminder.trim(), null, 2); // sans heure : un pense-bête
            setNewReminder("");
          }}
        >
          <input value={newReminder} onChange={(e) => setNewReminder(e.target.value)} placeholder="Nouveau pense-bête…" aria-label="Nouveau pense-bête" className="h-11 w-full rounded-full bg-surface px-4 text-[15px] outline-none placeholder:text-faint focus:ring-1 focus:ring-accent/50" />
        </form>
      </section>

      {editor && <EventEditor target={editor} accessCode={accessCode} onUnauthorized={onUnauthorized} onDone={done} onClose={() => setEditor(null)} />}
      {openGoogle && <EventSheet e={openGoogle} onClose={() => setOpenGoogle(null)} />}
      {opened && <TaskSheet key={opened.id} t={opened} api={api} onClose={() => setOpenTask(null)} />}
    </div>
  );
}
