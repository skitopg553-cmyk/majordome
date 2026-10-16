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

/**
 * RÈGLE AGENDA / TÂCHE (en code, sans migration) : un élément avec une heure précise est de l'AGENDA (Planning, frise) ;
 * un élément sans heure (à 00:00 Paris, ou sans date) est une TÂCHE (Accueil). Une seule table, deux affichages.
 */
export const isAgenda = (t: { due_at: string | null }) => !!t.due_at && hasTime(t.due_at);

/** Les tâches de l'Accueil, dans l'ordre : en retard, aujourd'hui, sans date, puis les jours à venir. Seulement ce qui reste à faire. */
export function homeTasks<X extends T>(tasks: X[], now: Date): X[] {
  const today = parisDay(now);
  const rank = (t: X) => (!t.due_at ? 2 : parisDay(new Date(t.due_at)) < today ? 0 : parisDay(new Date(t.due_at)) === today ? 1 : 3);
  return tasks
    .filter((t) => t.status === "todo" && !isAgenda(t))
    .sort((a, b) => rank(a) - rank(b) || (a.due_at ?? "").localeCompare(b.due_at ?? ""));
}

/** Ce que la frise affiche pour un jour : seulement l'agenda (éléments avec heure), par heure. Les éléments terminés restent à leur place. */
export function planDay<X extends T>(tasks: X[], day: string): Map<number, X[]> {
  const byHour = new Map<number, X[]>();
  for (const t of tasks.filter((t) => isAgenda(t) && parisDay(new Date(t.due_at!)) === day).sort((a, b) => a.due_at!.localeCompare(b.due_at!))) {
    const { h } = parisHM(t.due_at!);
    byHour.set(h, [...(byHour.get(h) ?? []), t]);
  }
  return byHour;
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

/** Points de la frise de semaine : nombre d'éléments d'agenda à faire ce jour-là, plafonné à 3. */
export function dotsFor<X extends T>(tasks: X[], day: string) {
  const n = tasks.filter((t) => t.status === "todo" && isAgenda(t) && parisDay(new Date(t.due_at!)) === day).length;
  return Math.min(3, n);
}
