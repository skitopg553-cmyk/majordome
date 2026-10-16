// Briefing du jour (Accueil) : 3 lignes au plus, générées EN CODE (aucun appel IA) : prochain agenda, tâches, argent.
import { homeTasks, isAgenda, parisHM } from "./planning";
import { addDays, parisDay } from "./task-groups";

type T = { title: string; due_at: string | null; status: "todo" | "done" };
const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;
const hm = (iso: string) => {
  const { h, m } = parisHM(iso);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

export function briefing(input: { tasks: T[]; now: Date; free: number | null; overBudget: { category: string; over: number } | null }): string[] {
  const { tasks, now } = input;
  const today = parisDay(now);
  const lines: string[] = [];

  // 1. Prochain élément d'agenda (avec heure) pas encore passé.
  const next = tasks
    .filter((t) => t.status === "todo" && isAgenda(t) && new Date(t.due_at!) >= now)
    .sort((a, b) => a.due_at!.localeCompare(b.due_at!))[0];
  if (parisHM(now.toISOString()).h >= 18) {
    // Le soir : ce qui attend demain (la question de 23 h).
    const tomorrow = tasks
      .filter((t) => t.status === "todo" && isAgenda(t) && parisDay(new Date(t.due_at!)) === addDays(today, 1))
      .sort((a, b) => a.due_at!.localeCompare(b.due_at!));
    lines.push(tomorrow.length ? `Demain : ${tomorrow.length} rendez-vous, le premier à ${hm(tomorrow[0].due_at!)}` : "Demain : rien à l'agenda");
  } else if (!next) lines.push("Rien à l'agenda pour le moment.");
  else if (parisDay(new Date(next.due_at!)) === today) lines.push(`Prochain : ${next.title}, ${hm(next.due_at!)}`);
  else {
    const day = new Date(next.due_at!).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", weekday: "short", day: "numeric", month: "short" });
    lines.push(`Prochain : ${next.title}, ${day} ${hm(next.due_at!)}`);
  }

  // 2. Tâches du jour et en retard.
  const todo = homeTasks(tasks.map((t) => ({ ...t })), now);
  const late = todo.filter((t) => t.due_at && parisDay(new Date(t.due_at)) < today).length;
  const dueToday = todo.filter((t) => t.due_at && parisDay(new Date(t.due_at)) === today).length;
  if (dueToday + late === 0) lines.push("Aucune tâche urgente.");
  else lines.push(`${plural(dueToday, "tâche")} aujourd'hui${late ? `, ${late} en retard` : ""}`);

  // 3. Argent : un budget dépassé (dit calmement) sinon le « Libre » du mois.
  if (input.overBudget) lines.push(`Budget ${input.overBudget.category} dépassé de ${Math.round(input.overBudget.over)} €`);
  else if (input.free !== null) lines.push(`Libre ce mois : ${Math.round(input.free)} €`);
  return lines;
}
