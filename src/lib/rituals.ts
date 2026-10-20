// Rituels à l'ouverture de l'appli : des cartes viennent à Ruben selon l'heure (sommeil, briefing du matin, repas). Tout est calculé ICI, en code, sans appel IA.
// Garde-fous : jamais plus de 2 cartes à la fois (avec les bilans d'habitudes), priorité au plus urgent, une seule question par moment de la journée,
// « Plus tard » la repose à l'ouverture suivante (non mémorisé), rien de plus vieux que la journée en cours (l'état est remis à zéro chaque jour). Heure de Paris.
import { parisHM } from "./planning";
import { parisDay } from "./task-groups";

export const MAX_CARDS = 2;
export type Period = "breakfast" | "lunch" | "dinner";
export type RitualId = "sleep" | "briefing" | "meal-breakfast" | "meal-lunch" | "meal-dinner";
export type Answer = "done" | "none"; // « done » : fait ; « none » : « Rien » (rien mangé, pas de nuit à noter…)
export type RitualState = { day: string; answered: Partial<Record<RitualId, Answer>> };

/** Minutes depuis minuit, fin exclue. Petit-déjeuner jusqu'à 11 h, déjeuner 12 h-15 h, dîner 19 h-23 h ; le sommeil et le briefing : le matin, 5 h-12 h. */
export const WINDOWS: Record<Period | "morning", [number, number]> = { morning: [5 * 60, 12 * 60], breakfast: [5 * 60, 11 * 60], lunch: [12 * 60, 15 * 60], dinner: [19 * 60, 23 * 60] };
export const MEAL_LABEL: Record<Period, string> = { breakfast: "Petit-déjeuner", lunch: "Déjeuner", dinner: "Dîner" };

const minutesOf = (d: Date) => {
  const { h, m } = parisHM(d.toISOString());
  return h * 60 + m;
};
const inside = (min: number, w: [number, number]) => min >= w[0] && min < w[1];

/** Le moment du repas en cours (ou null entre deux repas). */
export const mealPeriod = (now: Date): Period | null => (["breakfast", "lunch", "dinner"] as const).find((p) => inside(minutesOf(now), WINDOWS[p])) ?? null;

/** Un repas noté (par l'heure de création) tombe-t-il dans la fenêtre de ce repas, AUJOURD'HUI ? */
export function mealLogged(createdAts: string[], period: Period, today: string): boolean {
  return createdAts.some((c) => parisDay(new Date(c)) === today && inside(minutesOf(new Date(c)), WINDOWS[period]));
}

/** État du jour relu du stockage du navigateur : tout ce qui n'est pas valide, ou qui date d'un autre jour, est remis à zéro. */
export function loadState(raw: unknown, today: string): RitualState {
  try {
    const o = (typeof raw === "string" ? JSON.parse(raw) : raw) as { day?: unknown; answered?: unknown } | null;
    if (o && o.day === today && o.answered && typeof o.answered === "object") {
      const answered: RitualState["answered"] = {};
      for (const [k, v] of Object.entries(o.answered as Record<string, unknown>)) if ((v === "done" || v === "none") && ["sleep", "briefing", "meal-breakfast", "meal-lunch", "meal-dinner"].includes(k)) answered[k as RitualId] = v;
      return { day: today, answered };
    }
  } catch {
    /* état illisible : on repart de zéro */
  }
  return { day: today, answered: {} };
}

/**
 * Les rituels à montrer MAINTENANT, du plus urgent au moins urgent :
 * sommeil (le matin, tant que la nuit n'est pas notée) → briefing « Votre journée » (le matin, une fois le sommeil réglé) → le repas en cours.
 * `snoozed` : « Plus tard » pendant cette ouverture seulement.
 */
export function currentRituals(o: { now: Date; sleepLogged: boolean; mealCreatedAts: string[]; state: RitualState; snoozed?: Set<RitualId> }): RitualId[] {
  const today = parisDay(o.now);
  const min = minutesOf(o.now);
  const answered = o.state.day === today ? o.state.answered : {};
  const skip = (id: RitualId) => !!answered[id] || !!o.snoozed?.has(id);
  const out: RitualId[] = [];
  const morning = inside(min, WINDOWS.morning);
  const sleepResolved = o.sleepLogged || !!answered.sleep;
  if (morning && !sleepResolved && !skip("sleep")) out.push("sleep");
  if (morning && sleepResolved && !skip("briefing")) out.push("briefing");
  const p = mealPeriod(o.now);
  if (p && !skip(`meal-${p}` as RitualId) && !mealLogged(o.mealCreatedAts, p, today)) out.push(`meal-${p}` as RitualId);
  return out;
}

/**
 * Plafond de 2 cartes au total, bilans d'habitudes compris. Ordre de priorité : sommeil, bilans d'habitudes, briefing, repas.
 * Renvoie combien de bilans montrer et quels rituels (dans l'ordre d'affichage).
 */
export function pickCards(o: { habitCount: number; rituals: RitualId[]; max?: number }): { habits: number; rituals: RitualId[] } {
  let room = o.max ?? MAX_CARDS;
  const rank = (id: RitualId) => (id === "sleep" ? 0 : id === "briefing" ? 2 : 3);
  const first = o.rituals.filter((r) => rank(r) === 0).slice(0, room);
  room -= first.length;
  const habits = Math.min(o.habitCount, room);
  room -= habits;
  const rest = o.rituals.filter((r) => rank(r) > 0).sort((a, b) => rank(a) - rank(b)).slice(0, Math.max(0, room));
  return { habits, rituals: [...first, ...rest] };
}

// ---------- « Votre journée, Monsieur » ----------

export type DaySlot = { title: string; start: string; end: string | null };
const clock = (iso: string) => {
  const { h, m } = parisHM(iso);
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
};
const plural = (n: number, w: string) => `${n} ${w}${n > 1 ? "s" : ""}`;

/** Le briefing du matin, assemblé en code : créneaux du jour, pense-bêtes, bilans en attente. `spoken` : le texte lu à voix haute (seulement après un tap). */
export function dayBriefing(o: { slots: DaySlot[]; reminders: string[]; pendingChecks: number }): { lines: string[]; spoken: string } {
  const slots = [...o.slots].sort((a, b) => a.start.localeCompare(b.start));
  const lines: string[] = [];
  if (slots.length) {
    const shown = slots.slice(0, 4).map((s) => `${s.title} ${clock(s.start)}${s.end ? `-${clock(s.end)}` : ""}`);
    lines.push(`Au programme : ${shown.join(", ")}${slots.length > 4 ? ` et ${plural(slots.length - 4, "autre")}` : ""}.`);
  } else lines.push("Rien de prévu à l'agenda.");
  if (o.reminders.length) lines.push(`${plural(o.reminders.length, "pense-bête")} : ${o.reminders.slice(0, 3).join(", ")}${o.reminders.length > 3 ? ` et ${o.reminders.length - 3} de plus` : ""}.`);
  if (o.pendingChecks) lines.push(`${plural(o.pendingChecks, "bilan")} d'habitude en attente.`);
  return { lines, spoken: `Votre journée, Monsieur. ${lines.join(" ")}` };
}
