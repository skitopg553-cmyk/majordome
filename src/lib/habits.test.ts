import { describe, expect, it } from "vitest";
import { doneThisWeek, habitQuestions, MAX_QUESTIONS, type HabitLog } from "./habits";
import type { StoredRule } from "./recurrence";
import type { SlotException } from "./slots";

// Salle : lundi, mercredi, vendredi, 18 h-20 h (heure de Paris). Le lundi 19/10/2026 est en heure d'été (UTC+2) : fin à 18:00Z.
const salle: StoredRule = { id: 1, title: "Salle", kind: "weekly", weekday: 1, days: "1,3,5", month_day: null, at_time: "18:00", end_time: "20:00", habit: 1, last_generated: null, created_at: "2026-10-01T08:00:00Z" };
const rule = (o: Partial<StoredRule>): StoredRule => ({ ...salle, ...o });
const ask = (o: { now: string; rules?: StoredRule[]; exceptions?: SlotException[]; logs?: HabitLog[]; snoozed?: string[] }) =>
  habitQuestions({ rules: o.rules ?? [salle], exceptions: o.exceptions ?? [], logs: o.logs ?? [], now: new Date(o.now), snoozed: new Set(o.snoozed ?? []) }).map((q) => q.key);

describe("quelles questions poser maintenant", () => {
  it("rien tant que le créneau n'est pas terminé", () => {
    expect(ask({ now: "2026-10-19T16:30:00Z" })).toEqual([]); // 18 h 30 Paris : en cours
    expect(ask({ now: "2026-10-19T17:59:00Z" })).toEqual([]); // 19 h 59
  });
  it("une fois fini : une question", () => {
    expect(ask({ now: "2026-10-19T18:05:00Z" })).toEqual(["1:2026-10-19"]); // 20 h 05 Paris
  });
  it("demandé jusqu'à 48 h après la fin, plus après", () => {
    const lundi = [rule({ days: "1" })];
    expect(ask({ now: "2026-10-21T17:59:00Z", rules: lundi })).toEqual(["1:2026-10-19"]); // 47 h 59
    expect(ask({ now: "2026-10-21T18:01:00Z", rules: lundi })).toEqual([]); // 48 h 01
  });
  it("plafond de 2 questions, les plus récentes d'abord", () => {
    const daily = { days: "1,2,3,4,5,6,7" };
    const many = [salle, rule({ id: 2, title: "Méditation", at_time: "07:00", end_time: "07:20", ...daily }), rule({ id: 3, title: "Sport", at_time: "12:00", end_time: "13:00", ...daily })];
    const keys = ask({ now: "2026-10-20T20:00:00Z", rules: many }); // mardi 22 h Paris
    expect(MAX_QUESTIONS).toBe(2);
    expect(keys).toEqual(["3:2026-10-20", "2:2026-10-20"]);
  });
  it("déjà répondu (oui ou non) : jamais redemandé ; « Plus tard » : pas dans cette ouverture, de retour à la suivante", () => {
    expect(ask({ now: "2026-10-19T18:05:00Z", logs: [{ rule_id: 1, day: "2026-10-19", status: "done" }] })).toEqual([]);
    expect(ask({ now: "2026-10-19T18:05:00Z", logs: [{ rule_id: 1, day: "2026-10-19", status: "missed" }] })).toEqual([]);
    expect(ask({ now: "2026-10-19T18:05:00Z", snoozed: ["1:2026-10-19"] })).toEqual([]);
    expect(ask({ now: "2026-10-19T18:05:00Z", snoozed: [] })).toEqual(["1:2026-10-19"]);
  });
  it("pas une habitude, pas de créneau ce jour-là, occurrence supprimée : rien", () => {
    expect(ask({ now: "2026-10-19T18:05:00Z", rules: [rule({ habit: 0 })] })).toEqual([]);
    expect(ask({ now: "2026-10-20T18:05:00Z", logs: [{ rule_id: 1, day: "2026-10-19", status: "done" }] })).toEqual([]); // mardi : pas de salle (le lundi est déjà répondu)
    const skipped: SlotException[] = [{ rule_id: 1, day: "2026-10-19", action: "skip", new_day: null, new_start: null, new_end: null }];
    expect(ask({ now: "2026-10-19T18:05:00Z", exceptions: skipped })).toEqual([]);
  });
  it("occurrence déplacée : une seule question, sous son jour d'origine, après sa nouvelle fin", () => {
    const moved: SlotException[] = [{ rule_id: 1, day: "2026-10-19", action: "move", new_day: "2026-10-20", new_start: "10:00", new_end: "11:00" }];
    expect(ask({ now: "2026-10-19T18:05:00Z", exceptions: moved })).toEqual([]); // plus ce soir-là
    expect(ask({ now: "2026-10-20T08:30:00Z", exceptions: moved })).toEqual([]); // 10 h 30 Paris : en cours
    expect(ask({ now: "2026-10-20T09:05:00Z", exceptions: moved })).toEqual(["1:2026-10-19"]); // 11 h 05 : fini
  });
  it("sans heure de fin : fini 1 h après le début", () => {
    const boxe = rule({ id: 9, title: "Boxe", days: "2", at_time: "18:30", end_time: null });
    expect(ask({ now: "2026-10-20T16:45:00Z", rules: [boxe] })).toEqual([]); // 18 h 45 Paris
    expect(ask({ now: "2026-10-20T17:45:00Z", rules: [boxe] })).toEqual(["9:2026-10-20"]); // 19 h 45 Paris
  });
  it("changement d'heure (dimanche 25/10/2026) : 20 h reste 20 h à Paris", () => {
    const dim = rule({ days: "7" });
    expect(ask({ now: "2026-10-25T18:30:00Z", rules: [dim] })).toEqual([]); // 19 h 30 Paris (UTC+1) : pas fini
    expect(ask({ now: "2026-10-25T19:05:00Z", rules: [dim] })).toEqual(["1:2026-10-25"]); // 20 h 05 Paris
    expect(ask({ now: "2026-10-24T18:05:00Z", rules: [rule({ days: "6" })] })).toEqual(["1:2026-10-24"]); // la veille : UTC+2, fin à 18:00Z
  });
  it("jamais de question sur un créneau fini avant la création de la règle", () => {
    expect(ask({ now: "2026-10-19T18:05:00Z", rules: [rule({ created_at: "2026-10-19T19:00:00Z" })] })).toEqual([]);
  });
});

describe("doneThisWeek : compteur positif seulement", () => {
  it("compte les « oui » des 7 derniers jours, jamais les « non »", () => {
    const logs: HabitLog[] = [
      { rule_id: 1, day: "2026-10-19", status: "done" },
      { rule_id: 1, day: "2026-10-17", status: "done" },
      { rule_id: 1, day: "2026-10-16", status: "missed" },
      { rule_id: 1, day: "2026-10-10", status: "done" },
      { rule_id: 2, day: "2026-10-19", status: "done" },
    ];
    expect(doneThisWeek(logs, 1, "2026-10-19")).toBe(2);
  });
});
