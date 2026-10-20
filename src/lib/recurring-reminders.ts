// Pense-bêtes qui reviennent (sans heure) : calculés à l'AFFICHAGE à partir de la règle et des « faits » (table recurring_checks), jamais copiés jour par jour.
// Coché = fait pour AUJOURD'HUI ; il revient le prochain jour prévu. « X fois par semaine » : visible chaque jour jusqu'à ce que le compte de la semaine (lundi → dimanche) soit atteint.
// Un pense-bête qui n'a pas été fait hier ne s'accumule pas : il n'y a toujours qu'UNE ligne par règle, et jamais de « en retard ». Heure de Paris.
import { ruleLabel, occursOn, type StoredRule } from "./recurrence";
import { weekOf } from "./planning";
import { parisDay } from "./task-groups";

export type RecurringCheck = { rule_id: number; day: string };
export type DueReminder = { ruleId: number; title: string; label: string; progress: { done: number; of: number } | null };

/** Identifiant « virtuel » d'un pense-bête récurrent dans les listes de tâches de l'écran (jamais un vrai id de la table tasks). */
export const VIRTUAL_BASE = 1_000_000_000;
export const virtualId = (ruleId: number) => VIRTUAL_BASE + ruleId;
export const ruleIdOf = (taskId: number) => (taskId > VIRTUAL_BASE ? taskId - VIRTUAL_BASE : null);

/** Une règle sans heure est un pense-bête qui revient ; avec une heure, c'est un créneau du calendrier. */
export const isRecurringReminder = (r: StoredRule) => !r.at_time;

const startsOn = (r: StoredRule) => (r.created_at ? parisDay(new Date(r.created_at)) : "0000-00-00"); // rien avant le jour de sa création

/** Les pense-bêtes récurrents à faire AUJOURD'HUI. */
export function dueReminders(rules: StoredRule[], checks: RecurringCheck[], today: string): DueReminder[] {
  const week = weekOf(today);
  const out: DueReminder[] = [];
  for (const r of rules) {
    if (!isRecurringReminder(r) || today < startsOn(r)) continue;
    const mine = checks.filter((c) => c.rule_id === r.id);
    if (mine.some((c) => c.day === today)) continue; // fait aujourd'hui
    if (r.per_week) {
      const done = mine.filter((c) => c.day >= week[0] && c.day <= week[6]).length;
      if (done >= r.per_week) continue; // compte de la semaine atteint
      out.push({ ruleId: r.id, title: r.title, label: ruleLabel(r), progress: { done, of: r.per_week } });
    } else if (occursOn(r, today)) {
      out.push({ ruleId: r.id, title: r.title, label: ruleLabel(r), progress: null });
    }
  }
  return out;
}
