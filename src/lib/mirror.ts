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

/** Prompt du bilan hebdomadaire (dimanche soir). Ton : ami organisé, jamais culpabilisant. */
export function weeklyPrompt(s: WeekSummary) {
  return `Tu es Majordome. Écris le bilan de la semaine de Ruben (du ${s.from} au ${s.to}).
Règles :
- Tutoie-le, ton simple et chaleureux, comme un ami organisé. Jamais culpabilisant : un chiffre bas est un point de départ, pas un reproche.
- Utilise UNIQUEMENT les chiffres ci-dessous. N'invente aucun chiffre, aucun pourcentage, aucune comparaison absente.
- 4 phrases maximum, puis UNE seule suggestion concrète pour la semaine prochaine.
Chiffres de la semaine :
- Tâches faites : ${s.tasksDone}
- Tâches en retard : ${s.tasksLate}
- Dépenses : ${s.spent} € (entrées : ${s.income} €)${s.topCategory ? `, surtout en ${s.topCategory.category} (${s.topCategory.spent} €)` : ""}
- Séances de sport : ${s.sessions} sur ${s.activeDays} jour(s)`;
}
