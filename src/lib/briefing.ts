// Briefing du jour (Accueil) : 4 lignes au plus, générées EN CODE (aucun appel IA) : prochain agenda, tâches, mails importants, argent.
// L'agenda mélange les éléments avec heure de majordome. ET les vrais événements Google (si connecté).
import { homeTasks, isAgenda, parisHM } from "./planning";
import { addDays, parisDay } from "./task-groups";

type T = { title: string; due_at: string | null; status: "todo" | "done" };
type GEvent = { title: string; start: string; allDay: boolean };
const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;
const hm = (iso: string) => {
  const { h, m } = parisHM(iso);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

export function briefing(input: {
  tasks: T[];
  events?: GEvent[]; // vrais événements Google (lecture seule)
  mails?: { count: number; subjects: string[] } | null; // mails importants non lus
  now: Date;
  free: number | null;
  overBudget: { category: string; over: number } | null;
}): string[] {
  const { tasks, now } = input;
  const today = parisDay(now);
  const lines: string[] = [];

  // Agenda = éléments avec heure : tâches datées à l'heure + événements Google (hors « toute la journée »), triés.
  const items = [
    ...tasks.filter((t) => t.status === "todo" && isAgenda(t)).map((t) => ({ title: t.title, at: t.due_at! })),
    ...(input.events ?? []).filter((e) => !e.allDay).map((e) => ({ title: e.title, at: e.start })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  const next = items.find((i) => new Date(i.at) >= now);

  if (parisHM(now.toISOString()).h >= 18) {
    // Le soir : ce qui attend demain (la question de 23 h).
    const tomorrow = items.filter((i) => parisDay(new Date(i.at)) === addDays(today, 1));
    lines.push(tomorrow.length ? `Demain : ${tomorrow.length} rendez-vous, le premier à ${hm(tomorrow[0].at)}` : "Demain : rien à l'agenda");
  } else if (!next) lines.push("Rien à l'agenda pour le moment.");
  else if (parisDay(new Date(next.at)) === today) {
    const others = items.filter((i) => parisDay(new Date(i.at)) === today && new Date(i.at) >= now).length - 1;
    lines.push(`Prochain : ${next.title}, ${hm(next.at)}${others > 0 ? ` · ${others} autre${others > 1 ? "s" : ""} aujourd'hui` : ""}`);
  } else {
    const day = new Date(next.at).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", weekday: "short", day: "numeric", month: "short" });
    lines.push(`Prochain : ${next.title}, ${day} ${hm(next.at)}`);
  }

  // Tâches du jour et en retard.
  const todo = homeTasks(tasks.map((t) => ({ ...t })), now);
  const late = todo.filter((t) => t.due_at && parisDay(new Date(t.due_at)) < today).length;
  const dueToday = todo.filter((t) => t.due_at && parisDay(new Date(t.due_at)) === today).length;
  if (dueToday + late === 0) lines.push("Aucune tâche urgente.");
  else lines.push(`${plural(dueToday, "tâche")} aujourd'hui${late ? `, ${late} en retard` : ""}`);

  // Mails importants (si Google est connecté et qu'il y en a) : le nombre, puis 3 objets au plus.
  if (input.mails && input.mails.count > 0) {
    const subjects = input.mails.subjects.filter(Boolean).slice(0, 3).map((s) => clip(s, 28));
    lines.push(`${plural(input.mails.count, "mail")} important${input.mails.count > 1 ? "s" : ""}${subjects.length ? ` : ${subjects.join(" · ")}` : ""}`);
  }

  // Argent : un budget dépassé (dit calmement) sinon le « Libre » du mois.
  if (input.overBudget) lines.push(`Budget ${input.overBudget.category} dépassé de ${Math.round(input.overBudget.over)} €`);
  else if (input.free !== null) lines.push(`Libre ce mois : ${Math.round(input.free)} €`);
  return lines;
}
