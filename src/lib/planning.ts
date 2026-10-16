// Vue jour du Planning : tout le découpage est calculé ici (heure de Paris), l'écran ne fait qu'afficher.
import { addDays, parisDay } from "./task-groups";

type T = { due_at: string | null; status: "todo" | "done" };

/** Heure et minute à Paris d'un instant ISO. */
export function parisHM(iso: string) {
  const [h, m] = new Date(iso)
    .toLocaleTimeString("en-GB", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .split(":")
    .map(Number);
  return { h, m };
}

/** Une tâche à 00:00 (heure de Paris) est « sans heure » : seul le jour compte (toute la journée). */
export const hasTime = (iso: string) => {
  const { h, m } = parisHM(iso);
  return h !== 0 || m !== 0;
};

export type DayPlan<X extends T> = {
  late: X[]; // à faire, d'un jour passé (affichées seulement sur aujourd'hui)
  undated: X[]; // à faire, sans échéance (affichées seulement sur aujourd'hui)
  allDay: X[]; // ce jour-là, sans heure
  byHour: Map<number, X[]>; // ce jour-là, avec heure, triées
};

/** Ce qu'on affiche pour le jour choisi. Les tâches terminées restent visibles à leur place. */
export function planDay<X extends T>(tasks: X[], day: string, now: Date): DayPlan<X> {
  const today = parisDay(now);
  const onDay = tasks.filter((t) => t.due_at && parisDay(new Date(t.due_at)) === day);
  const byHour = new Map<number, X[]>();
  for (const t of onDay.filter((t) => hasTime(t.due_at!)).sort((a, b) => a.due_at!.localeCompare(b.due_at!))) {
    const { h } = parisHM(t.due_at!);
    byHour.set(h, [...(byHour.get(h) ?? []), t]);
  }
  const isToday = day === today;
  return {
    late: isToday ? tasks.filter((t) => t.status === "todo" && t.due_at && parisDay(new Date(t.due_at)) < today) : [],
    undated: isToday ? tasks.filter((t) => t.status === "todo" && !t.due_at) : [],
    allDay: onDay.filter((t) => !hasTime(t.due_at!)),
    byHour,
  };
}

/** Plage d'heures affichée : 7 h–22 h au minimum, élargie si une tâche tombe en dehors. */
export function hourRange(hours: Iterable<number>, now?: { h: number } | null) {
  let start = 7;
  let end = 22;
  for (const h of [...hours, ...(now ? [now.h] : [])]) {
    start = Math.min(start, h);
    end = Math.max(end, h);
  }
  return { start, end };
}

/** Les 7 jours (lundi → dimanche) de la semaine qui contient `day`. */
export function weekOf(day: string) {
  const dow = (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7; // 0 = lundi
  return Array.from({ length: 7 }, (_, i) => addDays(day, i - dow));
}

/** Points de la frise de semaine : nombre de tâches à faire ce jour-là, plafonné à 3. */
export function dotsFor<X extends T>(tasks: X[], day: string) {
  const n = tasks.filter((t) => t.status === "todo" && t.due_at && parisDay(new Date(t.due_at)) === day).length;
  return Math.min(3, n);
}

/** Geste horizontal → -1 (jour précédent), 1 (jour suivant) ou 0. Il faut un geste franc (≥ 60 px) et plus horizontal que vertical, sinon c'est un défilement. */
export function swipeDirection(dx: number, dy: number): -1 | 0 | 1 {
  if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return 0;
  return dx < 0 ? 1 : -1; // glisser vers la gauche = jour suivant
}
