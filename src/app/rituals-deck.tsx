"use client";

import { useEffect, useMemo, useState } from "react";
import { habitQuestions } from "@/lib/habits";
import { currentRituals, loadState, MEAL_LABEL, pickCards, type Answer, type Period, type RitualId, type RitualState } from "@/lib/rituals";
import { QUALITIES, shiftHm, sleepHabit, sleepHours } from "@/lib/sleep";
import { parisDay } from "@/lib/task-groups";
import { callApi } from "./api-client";
import HabitCheck from "./habit-check";
import { mascotApi } from "./mascot-engine";
import { speakPhone } from "./speak";
import { Card, Label } from "./ui";
import type { SlotsApi } from "./use-slots";

const KEY = "majordome-rituals"; // état du jour dans ce navigateur : {day, answered}
const pill = "min-h-11 rounded-full px-4 text-[14px] font-semibold active:scale-95 disabled:opacity-50";

export type FormeInput = FormeLite | "loading" | "off"; // « off » : Forme illisible (seuls les bilans d'habitudes) ; « loading » : rien tant que ça charge
export type FormeLite = { sleeps: { date: string; hours: number; bed_time?: string | null; wake_time?: string | null }[]; meals: { created_at?: string }[] };

/**
 * Les cartes qui viennent à vous à l'ouverture de l'Accueil, selon l'heure : sommeil, bilans d'habitudes, briefing « Votre journée », repas.
 * Tout est décidé en code (src/lib/rituals.ts) : 2 cartes au plus, une seule question par moment, « Plus tard » revient à l'ouverture suivante.
 * La voix ne lit le briefing que sur un tap (« Écouter » ou la mascotte).
 */
export default function RitualDeck({ accessCode, onUnauthorized, slots, forme, onFormeChanged, day, onAsk, onListen, speakRef }: {
  accessCode: string;
  onUnauthorized: () => void;
  slots: SlotsApi;
  forme: FormeInput;
  onFormeChanged: () => void;
  day: { lines: string[]; spoken: string };
  onAsk: (text: string) => void;
  onListen: (prefix: string) => void;
  speakRef: { current: (() => void) | null }; // la mascotte de l'en-tête lit le briefing par ce crochet
}) {
  const [state, setState] = useState<RitualState | null>(null);
  const [snoozed, setSnoozed] = useState<Set<RitualId>>(new Set()); // « Plus tard » : pendant cette ouverture seulement
  const [hiddenHabits, setHiddenHabits] = useState<Set<string>>(new Set());
  const today = parisDay(new Date());

  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(KEY);
    } catch {
      /* stockage indisponible : on repart de zéro à chaque ouverture */
    }
    setState(loadState(raw, today));
  }, [today]);

  function mark(id: RitualId, a: Answer) {
    setState((cur) => {
      const next: RitualState = { day: today, answered: { ...(cur?.day === today ? cur.answered : {}), [id]: a } };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }
  const later = (id: RitualId) => setSnoozed((s) => new Set(s).add(id));

  const now = new Date();
  const habitAll = useMemo(
    () => habitQuestions({ rules: slots.rules, exceptions: slots.exceptions, logs: slots.logs, oneoffs: slots.oneoffs, now: new Date(), snoozed: hiddenHabits }),
    [slots.rules, slots.exceptions, slots.logs, slots.oneoffs, hiddenHabits],
  );
  const rituals = state && forme !== "loading" && forme !== "off"
    ? currentRituals({ now, sleepLogged: forme.sleeps.some((s) => s.date === today), mealCreatedAts: forme.meals.map((m) => m.created_at).filter((c): c is string => !!c), state, snoozed })
    : [];
  const picked = pickCards({ habitCount: habitAll.length, rituals });
  const habits = habitAll.slice(0, picked.habits);
  const has = (id: RitualId) => picked.rituals.includes(id);
  const meal = picked.rituals.find((r) => r.startsWith("meal-")) as `meal-${Period}` | undefined;

  // La mascotte de l'en-tête : un tap lit le briefing (seul geste qui autorise le son).
  speakRef.current = () => speakPhone(day.spoken);

  if (!state || forme === "loading") return null; // pas de carte qui saute : on attend d'avoir tout lu
  if (forme === "off") return <HabitCheck slots={slots} questions={habitAll.slice(0, 2)} onHide={(k) => setHiddenHabits((h) => new Set(h).add(k))} />; // Forme illisible : seuls les bilans, comme avant

  return (
    <>
      {has("sleep") && <SleepCard accessCode={accessCode} onUnauthorized={onUnauthorized} forme={forme} today={today} onSaved={() => { mark("sleep", "done"); onFormeChanged(); }} onSkip={() => mark("sleep", "none")} onLater={() => later("sleep")} />}
      <HabitCheck slots={slots} questions={habits} onHide={(k) => setHiddenHabits((h) => new Set(h).add(k))} />
      {has("briefing") && (
        <Card>
          <Label>Votre journée, Monsieur</Label>
          <ul className="mt-1 space-y-1 text-[15px] leading-snug">
            {day.lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => speakPhone(day.spoken)} className={`${pill} bg-accent text-ink`}>
              Écouter
            </button>
            <button onClick={() => mark("briefing", "done")} className={`${pill} bg-raised text-fg ring-1 ring-line`}>
              Merci
            </button>
          </div>
        </Card>
      )}
      {meal && <MealCard period={meal.slice(5) as Period} onAsk={(t) => { mark(meal, "done"); onAsk(t); }} onListen={(p) => { mark(meal, "done"); onListen(p); }} onNone={() => mark(meal, "none")} onLater={() => later(meal)} />}
    </>
  );
}

/** « Bonjour, Monsieur. Comment avez-vous dormi ? » : coucher et lever pré-remplis avec vos habitudes ; la qualité en un tap enregistre la nuit. */
function SleepCard({ accessCode, onUnauthorized, forme, today, onSaved, onSkip, onLater }: { accessCode: string; onUnauthorized: () => void; forme: NonNullable<FormeLite>; today: string; onSaved: () => void; onSkip: () => void; onLater: () => void }) {
  const habit = useMemo(() => sleepHabit(forme.sleeps), [forme.sleeps]);
  const [bed, setBed] = useState(habit.bed);
  const [wake, setWake] = useState(habit.wake);
  const [edit, setEdit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hours = sleepHours(bed, wake);
  const hm = (v: string) => `${Number(v.slice(0, 2))} h${v.slice(3) === "00" ? "" : ` ${v.slice(3)}`}`;

  async function save(quality: number) {
    if (hours === null) return setError("Ces heures ne donnent pas une nuit plausible, Monsieur.");
    setBusy(true);
    setError(null);
    try {
      await callApi(accessCode, "/api/forme", { method: "POST", body: { type: "sleep", date: today, bed, wake, quality }, onUnauthorized });
      mascotApi.react("happy", 1500);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enregistrement impossible");
      setBusy(false);
    }
  }
  const step = "flex size-11 items-center justify-center rounded-full bg-raised text-xl active:scale-95";
  const time = (label: string, value: string, set: (v: string) => void) => (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[14px] text-muted">{label}</span>
      <span className="flex items-center gap-2">
        <button onClick={() => set(shiftHm(value, -15))} aria-label={`${label} : 15 minutes plus tôt`} className={step}>−</button>
        <span className="w-20 text-center text-[17px] font-semibold tabular-nums">{hm(value)}</span>
        <button onClick={() => set(shiftHm(value, 15))} aria-label={`${label} : 15 minutes plus tard`} className={step}>+</button>
      </span>
    </div>
  );

  return (
    <Card>
      <Label>Sommeil</Label>
      <p className="mt-1 text-[17px] font-semibold leading-snug tracking-tight">Bonjour, Monsieur. Comment avez-vous dormi ?</p>
      <p className="mt-0.5 text-[13px] text-muted">
        Couché à {hm(bed)}, levé à {hm(wake)}
        {hours !== null && ` · ${Math.floor(hours)} h ${String(Math.round((hours % 1) * 60)).padStart(2, "0")}`}{" "}
        <button onClick={() => setEdit(!edit)} className="min-h-11 text-accent">{edit ? "Fermer" : "Modifier"}</button>
      </p>
      {edit && (
        <div className="rise mt-1 space-y-2 border-t border-line pt-3">
          {time("Coucher", bed, setBed)}
          {time("Lever", wake, setWake)}
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        {QUALITIES.map((q) => (
          <button key={q.value} onClick={() => save(q.value)} disabled={busy} className={`${pill} ${q.value === 3 ? "bg-accent text-ink" : "bg-raised text-fg ring-1 ring-line"}`}>
            {q.label}
          </button>
        ))}
        <button onClick={onLater} className={`${pill} text-muted active:bg-raised`}>Plus tard</button>
        <button onClick={onSkip} className={`${pill} text-muted active:bg-raised`}>Passer</button>
      </div>
      {error && <p className="mt-2 text-[13px] text-neg">{error}</p>}
    </Card>
  );
}

/** « Qu'avez-vous mangé ? » : texte ou voix, analysé par le chat avec la base nutrition. « Rien » : rien mangé à ce moment. */
function MealCard({ period, onAsk, onListen, onNone, onLater }: { period: Period; onAsk: (text: string) => void; onListen: (prefix: string) => void; onNone: () => void; onLater: () => void }) {
  const [text, setText] = useState("");
  const prefix = { breakfast: "Au petit-déjeuner, j'ai mangé : ", lunch: "Au déjeuner, j'ai mangé : ", dinner: "Au dîner, j'ai mangé : " }[period];
  return (
    <Card>
      <Label>{MEAL_LABEL[period]}</Label>
      <p className="mt-1 text-[17px] font-semibold leading-snug tracking-tight">Qu&apos;avez-vous mangé, Monsieur ?</p>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) onAsk(`${prefix}${text.trim()}`);
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Deux œufs, du pain…" aria-label="Ce que vous avez mangé" className="h-11 min-w-0 flex-1 rounded-full bg-raised px-4 text-[15px] outline-none placeholder:text-faint focus:ring-1 focus:ring-accent/50" />
        <button type="button" onClick={() => onListen(prefix)} aria-label="Dicter" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-raised text-muted active:scale-95">
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
            <rect x="9" y="3" width="6" height="12" rx="3" />
            <path d="M5 11a7 7 0 0014 0M12 18v3" />
          </svg>
        </button>
        <button type="submit" disabled={!text.trim()} className={`${pill} shrink-0 bg-accent text-ink`}>Noter</button>
      </form>
      <div className="mt-2 flex gap-2">
        <button onClick={onNone} className={`${pill} bg-raised text-fg ring-1 ring-line`}>Rien</button>
        <button onClick={onLater} className={`${pill} text-muted active:bg-raised`}>Plus tard</button>
      </div>
    </Card>
  );
}
