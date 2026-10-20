// Sport : classement des titres en code (dictionnaire), séance créée quand une habitude sportive est confirmée, régularité et répartition pour l'écran Forme.
// L'IA n'intervient que pour un titre d'habitude absent du dictionnaire (voir sport-ai.ts) ; tout le reste est calculé ici. Heure de Paris.
import type { StoredRule } from "./recurrence";
import type { HabitLog, OneOff } from "./habits";
import { occurrencesOn, type SlotException } from "./slots";
import { addDays, parisDay } from "./task-groups";
import { fold } from "./text";

// Du plus précis au plus général : le premier qui correspond gagne (« boxe thaï » avant « boxe », « sport » en dernier).
const SPORTS: [string, RegExp][] = [
  ["Boxe thaï", /\b(boxe thai|muay thai)\b/],
  ["Boxe anglaise", /\b(boxe|boxing|sac de frappe)\b/],
  ["Musculation", /\b(muscu|musculation|salle|gym|fitness|basic fit|renfo|renforcement|pompes|haltero)\b/],
  ["CrossFit", /\b(crossfit|cross fit|hiit)\b/],
  ["Course à pied", /\b(course a pied|running|footing|jogging|courir|trail)\b/],
  ["Natation", /\b(natation|piscine|nager)\b/],
  ["Vélo", /\b(velo|cyclisme|spinning|bike)\b/],
  ["Football", /\b(foot|football|five)\b/],
  ["Yoga", /\byoga\b/],
  ["Pilates", /\bpilates\b/],
  ["Tennis", /\btennis\b/],
  ["Padel", /\bpadel\b/],
  ["Badminton", /\bbadminton\b/],
  ["Basket", /\b(basket|basketball)\b/],
  ["Handball", /\bhand(ball)?\b/],
  ["Escalade", /\b(escalade|bloc|grimpe)\b/],
  ["Danse", /\bdanse\b/],
  ["Randonnée", /\b(rando|randonnee|marche sportive)\b/],
  ["Judo", /\bjudo\b/],
  ["Karaté", /\bkarate\b/],
  ["MMA", /\bmma\b/],
  ["Sport", /\b(sport|entrainement|training|seance)\b/],
];
// Faux amis : contiennent un mot du dictionnaire sans être du sport.
const NOT_SPORT_FRIENDS = /(salle (de reunion|d attente|de classe|a manger)|bloc ?notes?|football a la tele|match a la tele|hand ?off|handover)/;
// Habitudes connues qui ne sont PAS du sport : elles gardent leur régularité mais n'entrent jamais dans les séances.
const OTHER_HABITS = /\b(meditation|mediter|lecture|lire|creatine|vitamine|complement|journal|ecriture|ecrire|etirement|stretching|boire|eau|sommeil|dormir|coucher|reveil|langue|anglais|espagnol|piano|guitare|dessin|gratitude|brossage|rangement|menage|courses|medicament)\b/;

export type SportClass = { kind: "sport"; sport: string } | { kind: "other" } | { kind: "unknown" };

const clean = (s: string) => ` ${fold(s).replace(/[’']/g, " ").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim()} `;

/** Titre d'habitude → sport connu, habitude non sportive connue, ou inconnu (seul cas où l'IA est consultée). */
export function classifySport(title: string): SportClass {
  const t = clean(title);
  if (NOT_SPORT_FRIENDS.test(t)) return { kind: "other" };
  for (const [sport, re] of SPORTS) if (re.test(t)) return { kind: "sport", sport };
  if (OTHER_HABITS.test(t)) return { kind: "other" };
  return { kind: "unknown" };
}

/** Nom de sport normalisé pour regrouper « Salle », « Muscu » et « Musculation » ; un type inconnu reste tel quel. */
export const canonicalSport = (kind: string) => {
  const c = classifySport(kind);
  return c.kind === "sport" ? c.sport : kind.trim();
};

/** Durée d'un créneau en minutes (« 18:30 » → « 20:00 » = 90), ou null sans fin (ou fin avant début). */
export function slotMinutes(start: string | null | undefined, end: string | null | undefined): number | null {
  if (!start || !end) return null;
  const m = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
  const d = m(end) - m(start);
  return d > 0 ? d : null;
}

// ---------- Création de la séance quand l'habitude est confirmée ----------

export type WorkoutStore = {
  has: (date: string, kind: string) => Promise<boolean>;
  add: (w: { date: string; kind: string; minutes: number | null }) => Promise<void>;
};

/**
 * « Oui » à l'habitude → une séance dans Forme (sport déduit du titre, jour du créneau, durée du créneau).
 * Pas de doublon : si une séance du même sport existe déjà ce jour-là (ou si l'habitude était déjà confirmée), rien n'est ajouté.
 * `askAI` n'est appelé que pour un titre inconnu ; sans réponse, l'habitude n'est pas considérée comme du sport.
 */
export async function recordHabitSession(
  rule: { title: string; at_time: string | null; end_time?: string | null },
  day: string,
  store: WorkoutStore,
  o: { alreadyDone?: boolean; askAI?: (title: string) => Promise<string | null> } = {},
): Promise<"created" | "exists" | "not-sport"> {
  if (o.alreadyDone) return "exists";
  const c = classifySport(rule.title);
  let sport: string | null = c.kind === "sport" ? c.sport : null;
  if (c.kind === "unknown" && o.askAI) sport = await o.askAI(rule.title).catch(() => null);
  if (!sport) return "not-sport";
  if (await store.has(day, sport)) return "exists";
  await store.add({ date: day, kind: sport, minutes: slotMinutes(rule.at_time, rule.end_time) });
  return "created";
}

// ---------- Écran Forme : semaine, régularité, répartition, série ----------

export type Planned = { key: string; ruleId: number; sport: string; day: string; start: string; end: string; status: "done" | "missed" | "pending" | "upcoming" };
export type WorkoutRow = { date: string; kind: string; minutes: number | null };

const iso = (d: Date) => d.toISOString();

/** Séances prévues (créneaux d'habitude sportive) des `back` derniers jours jusqu'à dimanche prochain, avec leur état. */
export function plannedSessions(o: { rules: StoredRule[]; exceptions: SlotException[]; logs: HabitLog[]; workouts: WorkoutRow[]; now: Date; back?: number; oneoffs?: OneOff[] }): Planned[] {
  const today = parisDay(o.now);
  const dow = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7;
  const last = addDays(today, 6 - dow);
  const sporty = o.rules
    .filter((r) => r.habit && r.at_time)
    .map((r) => ({ r, c: classifySport(r.title) }))
    .filter((x) => x.c.kind === "sport")
    .map((x) => x.r);
  const sportOf = new Map(sporty.map((r) => [r.id, (classifySport(r.title) as { sport: string }).sport]));
  const logs = new Map(o.logs.map((l) => [`${l.rule_id}:${l.day}`, l.status]));
  const out: Planned[] = [];
  for (let d = addDays(today, -(o.back ?? 28)); d <= last; d = addDays(d, 1)) {
    for (const occ of occurrencesOn(sporty, o.exceptions, d)) {
      const sport = sportOf.get(occ.ruleId)!;
      const end = occ.end ?? iso(new Date(Date.parse(occ.start) + 3_600_000));
      const log = logs.get(occ.key);
      const hadWorkout = o.workouts.some((w) => w.date === d && canonicalSport(w.kind) === sport);
      const over = Date.parse(end) <= o.now.getTime();
      const status = log === "done" || hadWorkout ? "done" : log === "missed" ? "missed" : over ? "pending" : "upcoming";
      out.push({ key: occ.key, ruleId: occ.ruleId, sport, day: d, start: occ.start, end, status });
    }
  }
  // Séances ponctuelles (« demain je vais courir à 7 h ») : même état, la réponse est sur la tâche.
  for (const t of o.oneoffs ?? []) {
    const c = classifySport(t.title);
    if (c.kind !== "sport" || !t.due_at) continue;
    const d = parisDay(new Date(t.due_at));
    if (d < addDays(today, -(o.back ?? 28)) || d > last) continue;
    const end = t.end_at ?? iso(new Date(Date.parse(t.due_at) + 3_600_000));
    const hadWorkout = o.workouts.some((w) => w.date === d && canonicalSport(w.kind) === c.sport);
    const over = Date.parse(end) <= o.now.getTime();
    const status = t.habit_status === "done" || hadWorkout ? "done" : t.habit_status === "missed" ? "missed" : over ? "pending" : "upcoming";
    out.push({ key: `t${t.id}`, ruleId: 0, sport: c.sport, day: d, start: t.due_at, end, status });
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}

/** Régularité par sport : séances faites / séances prévues (terminées), en %. Une séance restée sans réponse compte comme non faite. */
export function regularity(planned: Planned[]) {
  const by = new Map<string, { done: number; planned: number }>();
  for (const p of planned) {
    if (p.status === "upcoming") continue;
    const e = by.get(p.sport) ?? { done: 0, planned: 0 };
    e.planned++;
    if (p.status === "done") e.done++;
    by.set(p.sport, e);
  }
  return [...by.entries()].map(([sport, e]) => ({ sport, ...e, pct: Math.round((e.done / e.planned) * 100) })).sort((a, b) => b.planned - a.planned || a.sport.localeCompare(b.sport));
}

/** Répartition des séances réellement faites (prévues ou non) par sport sur la période. */
export function distribution(workouts: WorkoutRow[], since: string) {
  const by = new Map<string, number>();
  for (const w of workouts) if (w.date >= since) by.set(canonicalSport(w.kind), (by.get(canonicalSport(w.kind)) ?? 0) + 1);
  const total = [...by.values()].reduce((a, b) => a + b, 0);
  return [...by.entries()].map(([sport, n]) => ({ sport, n, pct: Math.round((n / total) * 100) })).sort((a, b) => b.n - a.n || a.sport.localeCompare(b.sport));
}

/** Série positive : séances prévues faites d'affilée, de la plus récente vers le passé ; s'arrête à la première non faite. Les séances à venir ne comptent pas. */
export function streak(planned: Planned[]) {
  let n = 0;
  for (const p of [...planned].filter((x) => x.status !== "upcoming").sort((a, b) => b.end.localeCompare(a.end))) {
    if (p.status !== "done") break;
    n++;
  }
  return n;
}
