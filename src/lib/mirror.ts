// Miroir (phase 6, PRÉPARÉ) : résumé chiffré de la semaine, calculé en code, puis bilan rédigé par l'IA.
// L'IA ne reçoit QUE ces chiffres : elle commente, elle n'invente rien.
import { mondayOf, type Workout } from "./forme";
import type { Tx } from "./finance/stats";
import { addDays, parisDay } from "./task-groups";

export type MirrorTask = { status: string; due_at: string | null; done_at: string | null };

export type WeekSummary = {
  from: string; // lundi AAAA-MM-JJ
  to: string; // dimanche
  tasksDone: number;
  tasksLate: number; // échéance passée dans la semaine, toujours pas faite
  spent: number;
  income: number;
  topCategory: { category: string; spent: number } | null;
  sessions: number;
  activeDays: number;
};

export function weekSummary(input: { tasks: MirrorTask[]; transactions: Tx[]; workouts: Workout[] }, now: Date): WeekSummary {
  const from = mondayOf(now);
  const to = addDays(from, 6);
  const inWeek = (day: string) => day >= from && day <= to;
  const dayOf = (iso: string) => parisDay(new Date(iso));

  const tasksDone = input.tasks.filter((t) => t.status === "done" && t.done_at && inWeek(dayOf(t.done_at))).length;
  const tasksLate = input.tasks.filter((t) => t.status === "todo" && t.due_at && inWeek(dayOf(t.due_at)) && new Date(t.due_at) < now).length;

  // Comme pour le mois : l'épargne n'est pas une dépense.
  const weekTx = input.transactions.filter((t) => inWeek(t.date) && t.category !== "Épargne");
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const spent = round2(weekTx.reduce((a, t) => a + (t.amount < 0 ? -t.amount : 0), 0));
  const income = round2(weekTx.reduce((a, t) => a + (t.amount > 0 ? t.amount : 0), 0));
  const byCat = new Map<string, number>();
  for (const t of weekTx) if (t.amount < 0) byCat.set(t.category, (byCat.get(t.category) ?? 0) - t.amount);
  const top = [...byCat.entries()].sort((a, b) => b[1] - a[1])[0];

  const weekWorkouts = input.workouts.filter((w) => inWeek(w.date));
  return {
    from,
    to,
    tasksDone,
    tasksLate,
    spent,
    income,
    topCategory: top ? { category: top[0], spent: round2(top[1]) } : null,
    sessions: weekWorkouts.length,
    activeDays: new Set(weekWorkouts.map((w) => w.date)).size,
  };
}

// ---------- Miroir réel : chiffres de la semaine (en code) + 2-3 phrases de l'IA à partir de ces chiffres ----------

export type MirrorInput = {
  tasks: MirrorTask[];
  transactions: Tx[];
  workouts: Workout[];
  sleeps?: { date: string; hours: number }[]; // null/absent = pas de données
  meals?: { date: string; kcal: number }[];
};
export type Mirror = WeekSummary & {
  spentPrev: number; // dépenses de la semaine d'avant (même calcul)
  spentDeltaPct: number | null; // écart en %, null si la semaine d'avant est à 0
  sleepAvg: number | null; // heures par nuit notée
  nights: number;
  kcalAvg: number | null; // kcal par jour où un repas est noté
  mealDays: number;
};

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function weekMirror(input: MirrorInput, now: Date): Mirror {
  const s = weekSummary(input, now);
  const prevNow = new Date(new Date(`${addDays(s.from, -1)}T12:00:00Z`).getTime()); // dimanche d'avant : sa semaine = la précédente
  const prev = weekSummary({ tasks: [], transactions: input.transactions, workouts: [] }, prevNow);
  const inWeek = (d: string) => d >= s.from && d <= s.to;
  const sleeps = (input.sleeps ?? []).filter((x) => inWeek(x.date));
  const meals = (input.meals ?? []).filter((x) => inWeek(x.date));
  const kcalByDay = new Map<string, number>();
  for (const m of meals) kcalByDay.set(m.date, (kcalByDay.get(m.date) ?? 0) + m.kcal);
  const sleepAvg = avg(sleeps.map((x) => x.hours));
  const kcalAvg = avg([...kcalByDay.values()]);
  return {
    ...s,
    spentPrev: prev.spent,
    spentDeltaPct: prev.spent > 0 ? Math.round(((s.spent - prev.spent) / prev.spent) * 100) : null,
    sleepAvg: sleepAvg === null ? null : Math.round(sleepAvg * 100) / 100,
    nights: sleeps.length,
    kcalAvg: kcalAvg === null ? null : Math.round(kcalAvg),
    mealDays: kcalByDay.size,
  };
}

/** Les faits, une ligne chacun : c'est tout ce que l'IA reçoit (et la liste des nombres qu'elle a le droit de citer). */
export function mirrorFacts(m: Mirror): string[] {
  const lines = [
    `Tâches faites : ${m.tasksDone}, en retard : ${m.tasksLate}`,
    `Dépenses : ${m.spent} €${m.spentDeltaPct === null ? "" : ` (semaine d'avant : ${m.spentPrev} €, ${m.spentDeltaPct > 0 ? "+" : ""}${m.spentDeltaPct} %)`}${m.topCategory ? `, surtout ${m.topCategory.category} (${m.topCategory.spent} €)` : ""}`,
    `Séances de sport : ${m.sessions} sur ${m.activeDays} jour(s)`,
  ];
  if (m.sleepAvg !== null) lines.push(`Sommeil : ${m.sleepAvg} h par nuit en moyenne (${m.nights} nuits notées)`);
  if (m.kcalAvg !== null) lines.push(`Repas : ${m.kcalAvg} kcal par jour en moyenne (${m.mealDays} jours notés)`);
  return lines;
}

export function mirrorPrompt(m: Mirror) {
  return `Tu es Majordome. Écris 2 ou 3 phrases d'observation sur la semaine de Ruben, puis au plus UNE piste concrète.
Règles : tutoie-le, ton d'un ami organisé, bienveillant, jamais culpabilisant. Utilise UNIQUEMENT les chiffres ci-dessous, n'en invente aucun, ne calcule rien de nouveau. Pas de liste, pas de titre.
${mirrorFacts(m).map((l) => `- ${l}`).join("\n")}`;
}

/** Garde-fou : une phrase de l'IA n'est gardée que si chaque nombre qu'elle cite figure dans les faits. */
export function noteIsGrounded(note: string, m: Mirror) {
  const nums = (s: string) => (s.match(/\d+(?:[.,]\d+)?/g) ?? []).map((x) => Number(x.replace(",", ".")));
  const allowed = new Set(nums(mirrorFacts(m).join(" ")));
  return nums(note).every((n) => allowed.has(n));
}
