// Forme (phase 5) : logique pure, testée dans forme.test.ts.
import { addDays, parisDay } from "./task-groups";

/** Mots-clés de sport dans un titre d'événement (sans accents, minuscules). « course » seul = les courses, donc exclu. */
const SPORT = [
  "sport",
  "salle",
  "muscu",
  "musculation",
  "gym",
  "fitness",
  "basic fit",
  "crossfit",
  "hiit",
  "running",
  "footing",
  "jogging",
  "course a pied",
  "trail",
  "yoga",
  "pilates",
  "natation",
  "piscine",
  "velo",
  "cyclisme",
  "spinning",
  "foot",
  "five",
  "basket",
  "hand",
  "tennis",
  "padel",
  "badminton",
  "boxe",
  "mma",
  "judo",
  "karate",
  "escalade",
  "bloc",
  "danse",
  "rando",
  "randonnee",
  "seance de sport",
  "entrainement",
  "training",
];
// Faux amis : contiennent un mot-clé mais ne sont pas du sport.
const NOT_SPORT = ["salle de reunion", "salle d'attente", "salle de classe", "football a la tele", "match a la tele", "hand-off", "handover", "bloc-notes"];

const norm = (s: string) =>
  ` ${s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()} `;

/** Vrai si le titre d'un événement d'agenda ressemble à une séance de sport (mots entiers uniquement). */
export function isWorkoutTitle(title: string) {
  const t = norm(title);
  const raw = ` ${title.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()} `;
  if (NOT_SPORT.some((n) => raw.includes(n))) return false;
  return SPORT.some((k) => t.includes(` ${k} `));
}

export type Workout = { date: string; kind: string; minutes: number | null }; // date AAAA-MM-JJ
export type Sleep = { date: string; hours: number }; // date = jour du réveil

/** Lundi (AAAA-MM-JJ) de la semaine en cours, calendrier de Paris. */
export function mondayOf(now: Date) {
  const today = parisDay(now);
  const dow = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7; // 0 = lundi
  return addDays(today, -dow);
}

/** Régularité de la semaine (lundi → dimanche) : jours actifs, séances, sommeil moyen. */
export function weekStats(workouts: Workout[], sleeps: Sleep[], now: Date) {
  const monday = mondayOf(now);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const inWeek = (d: string) => d >= days[0] && d <= days[6];
  const weekWorkouts = workouts.filter((w) => inWeek(w.date));
  const active = days.map((d) => weekWorkouts.some((w) => w.date === d));
  const nights = sleeps.filter((s) => inWeek(s.date));
  const avgSleep = nights.length ? nights.reduce((a, s) => a + s.hours, 0) / nights.length : null; // exact : arrondi à la minute à l'affichage
  return { days, active, sessions: weekWorkouts.length, activeDays: active.filter(Boolean).length, avgSleep, nightsLogged: nights.length };
}

/** « 7,2 » → « 7 h 12 ». */
export function hoursLabel(h: number) {
  const min = Math.round(h * 60); // via le total de minutes : 6,999 h → « 7 h 00 », pas « 6 h 60 »
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`;
}
