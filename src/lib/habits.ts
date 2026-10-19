// Bilan des habitudes : « Tu y es allé ? » pour les créneaux d'habitude terminés. Tout est calculé ici, en code (heure de Paris), l'IA n'intervient pas.
import type { StoredRule } from "./recurrence";
import { occurrencesOn, type SlotException } from "./slots";
import { addDays, parisDay } from "./task-groups";

export const MAX_QUESTIONS = 2; // jamais plus de 2 questions à la fois
export const MAX_AGE_MS = 48 * 3_600_000; // un créneau terminé depuis plus de 48 h n'est plus demandé
const DEFAULT_LENGTH_MS = 3_600_000; // sans heure de fin : le créneau est considéré fini 1 h après son début

export type HabitLog = { rule_id: number; day: string; status: "done" | "missed" };
export type Question = { key: string; ruleId: number; day: string; title: string; start: string; end: string };

/**
 * Les questions à poser MAINTENANT : créneaux d'habitude terminés (et pas depuis plus de 48 h), pas encore répondus, pas repoussés par « Plus tard »
 * (`snoozed` = clés repoussées pendant cette ouverture de l'appli : « Plus tard » revient à la prochaine ouverture). Les plus récents d'abord, 2 au plus.
 * Une occurrence déplacée est demandée sous son jour d'origine : une seule question par occurrence, même déplacée.
 */
export function habitQuestions(o: { rules: StoredRule[]; exceptions: SlotException[]; logs: HabitLog[]; now: Date; snoozed?: Set<string> }): Question[] {
  const habits = o.rules.filter((r) => r.habit && r.at_time);
  if (!habits.length) return [];
  const answered = new Set(o.logs.map((l) => `${l.rule_id}:${l.day}`));
  const t = o.now.getTime();
  const createdAt = new Map(habits.map((r) => [r.id, r.created_at ? Date.parse(r.created_at) : 0]));
  const out: Question[] = [];
  // 48 h en arrière = au plus 3 jours calendaires (+1 de marge pour les jours de changement d'heure) ; un déplacement peut venir d'un jour voisin.
  for (let i = -4; i <= 1; i++) {
    for (const occ of occurrencesOn(habits, o.exceptions, addDays(parisDay(o.now), i))) {
      const end = occ.end ? Date.parse(occ.end) : Date.parse(occ.start) + DEFAULT_LENGTH_MS;
      if (end > t || end < t - MAX_AGE_MS) continue; // pas fini, ou fini depuis trop longtemps
      if (answered.has(occ.key) || o.snoozed?.has(occ.key)) continue;
      if (end < createdAt.get(occ.ruleId)!) continue; // fini avant que la règle existe : on ne demande pas
      if (!out.some((q) => q.key === occ.key)) out.push({ key: occ.key, ruleId: occ.ruleId, day: occ.originDay, title: occ.title, start: occ.start, end: new Date(end).toISOString() });
    }
  }
  return out.sort((a, b) => b.end.localeCompare(a.end)).slice(0, MAX_QUESTIONS);
}

/** Nombre de fois où cette habitude a été confirmée sur les 7 derniers jours (compteur positif et discret : il ne compte jamais les « non »). */
export const doneThisWeek = (logs: HabitLog[], ruleId: number, today: string) => logs.filter((l) => l.rule_id === ruleId && l.status === "done" && l.day > addDays(today, -7) && l.day <= today).length;
