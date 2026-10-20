import { describe, expect, it } from "vitest";
import { currentRituals, dayBriefing, loadState, mealLogged, mealPeriod, pickCards, type RitualState } from "./rituals";
import { sleepHabit, sleepHours, shiftHm } from "./sleep";

// Mardi 20/10/2026, heure de Paris = UTC + 2 : « h(8) » = 8 h à Paris.
const at = (h: number, m = 0, day = "2026-10-20") => new Date(`${day}T${String(h - 2).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`);
const empty: RitualState = { day: "2026-10-20", answered: {} };
const now = (when: Date, o: { sleepLogged?: boolean; meals?: string[]; state?: RitualState; snoozed?: string[] } = {}) =>
  currentRituals({ now: when, sleepLogged: o.sleepLogged ?? false, mealCreatedAts: o.meals ?? [], state: o.state ?? empty, snoozed: new Set((o.snoozed ?? []) as never[]) });

describe("quelles cartes montrer maintenant : heures", () => {
  it("le matin (5 h-12 h) : d'abord le sommeil ; avant 5 h ou après midi : pas de carte sommeil", () => {
    expect(now(at(8))).toEqual(["sleep", "meal-breakfast"]);
    expect(now(at(4, 59))).toEqual([]);
    expect(now(at(5))).toEqual(["sleep", "meal-breakfast"]);
    expect(now(at(13))).toEqual(["meal-lunch"]);
  });
  it("petit-déjeuner jusqu'à 11 h, déjeuner 12 h-15 h, dîner 19 h-23 h, rien entre deux", () => {
    expect(mealPeriod(at(10, 59))).toBe("breakfast");
    expect(mealPeriod(at(11))).toBeNull();
    expect(mealPeriod(at(12))).toBe("lunch");
    expect(mealPeriod(at(14, 59))).toBe("lunch");
    expect(mealPeriod(at(15))).toBeNull();
    expect(mealPeriod(at(19))).toBe("dinner");
    expect(mealPeriod(at(22, 59))).toBe("dinner");
    expect(mealPeriod(at(23))).toBeNull();
  });
  it("le briefing du matin vient après le sommeil réglé (noté ou « passé »), jamais avant", () => {
    expect(now(at(8))).not.toContain("briefing");
    expect(now(at(8), { sleepLogged: true })).toEqual(["briefing", "meal-breakfast"]);
    expect(now(at(8), { state: { day: "2026-10-20", answered: { sleep: "none" } } })).toEqual(["briefing", "meal-breakfast"]);
    expect(now(at(13), { sleepLogged: true })).toEqual(["meal-lunch"]); // le briefing est du matin
  });
});

describe("déjà répondu, plus tard, changement de jour", () => {
  it("déjà répondu (fait ou « rien ») : jamais redemandé, une seule question par moment de la journée", () => {
    const state: RitualState = { day: "2026-10-20", answered: { sleep: "done", briefing: "done", "meal-breakfast": "none" } };
    expect(now(at(8, 30), { sleepLogged: true, state })).toEqual([]);
    expect(now(at(12, 30), { sleepLogged: true, state })).toEqual(["meal-lunch"]); // un autre moment : une nouvelle question
  });
  it("un repas déjà noté dans la fenêtre (par le chat, à 8 h 05) : pas de question", () => {
    expect(now(at(9), { sleepLogged: true, state: { day: "2026-10-20", answered: { briefing: "done" } }, meals: ["2026-10-20T06:05:00Z"] })).toEqual([]);
    expect(mealLogged(["2026-10-20T06:05:00Z"], "breakfast", "2026-10-20")).toBe(true);
    expect(mealLogged(["2026-10-19T06:05:00Z"], "breakfast", "2026-10-20")).toBe(false); // hier
    expect(mealLogged(["2026-10-20T11:00:00Z"], "breakfast", "2026-10-20")).toBe(false); // 13 h : c'est le déjeuner
  });
  it("« Plus tard » : absent pendant cette ouverture seulement ; à l'ouverture suivante (snoozed vide) il revient", () => {
    expect(now(at(8), { snoozed: ["sleep"] })).toEqual(["meal-breakfast"]);
    expect(now(at(8), { snoozed: [] })).toEqual(["sleep", "meal-breakfast"]);
  });
  it("changement de jour : l'état d'hier est ignoré, rien de plus vieux que la journée en cours", () => {
    const hier: RitualState = { day: "2026-10-19", answered: { sleep: "done", "meal-breakfast": "done" } };
    expect(now(at(8), { state: hier })).toEqual(["sleep", "meal-breakfast"]);
    expect(loadState(JSON.stringify(hier), "2026-10-20")).toEqual(empty);
    expect(loadState(JSON.stringify({ day: "2026-10-20", answered: { sleep: "done", pirate: "done", briefing: "x" } }), "2026-10-20")).toEqual({ day: "2026-10-20", answered: { sleep: "done" } });
    expect(loadState("n'importe quoi", "2026-10-20")).toEqual(empty);
    expect(loadState(null, "2026-10-20")).toEqual(empty);
  });
});

describe("plafond de 2 cartes et priorité", () => {
  it("sommeil d'abord, puis les bilans d'habitudes, puis le briefing, puis le repas", () => {
    expect(pickCards({ habitCount: 2, rituals: ["sleep", "meal-breakfast"] })).toEqual({ habits: 1, rituals: ["sleep"] });
    expect(pickCards({ habitCount: 2, rituals: ["briefing", "meal-breakfast"] })).toEqual({ habits: 2, rituals: [] });
    expect(pickCards({ habitCount: 1, rituals: ["briefing", "meal-breakfast"] })).toEqual({ habits: 1, rituals: ["briefing"] });
    expect(pickCards({ habitCount: 0, rituals: ["briefing", "meal-breakfast"] })).toEqual({ habits: 0, rituals: ["briefing", "meal-breakfast"] });
  });
  it("jamais plus de 2 cartes, quelle que soit la combinaison", () => {
    for (const habitCount of [0, 1, 2]) {
      for (const rituals of [[], ["sleep"], ["sleep", "meal-breakfast"], ["briefing", "meal-lunch"], ["meal-dinner"]] as never[][]) {
        const p = pickCards({ habitCount, rituals });
        expect(p.habits + p.rituals.length).toBeLessThanOrEqual(2);
      }
    }
  });
});

describe("briefing « Votre journée »", () => {
  it("créneaux, pense-bêtes et bilans, assemblés en code", () => {
    const b = dayBriefing({
      slots: [
        { title: "Boxe anglaise", start: "2026-10-20T16:30:00Z", end: "2026-10-20T18:00:00Z" },
        { title: "Cours", start: "2026-10-20T07:00:00Z", end: "2026-10-20T10:00:00Z" },
      ],
      reminders: ["Appeler la banque", "Sortir les poubelles"],
      pendingChecks: 1,
    });
    expect(b.lines).toEqual(["Au programme : Cours 9 h-12 h, Boxe anglaise 18 h 30-20 h.", "2 pense-bêtes : Appeler la banque, Sortir les poubelles.", "1 bilan d'habitude en attente."]);
    expect(b.spoken.startsWith("Votre journée, Monsieur.")).toBe(true);
  });
  it("journée vide : dit honnêtement qu'il n'y a rien, sans chiffre inventé", () => {
    expect(dayBriefing({ slots: [], reminders: [], pendingChecks: 0 }).lines).toEqual(["Rien de prévu à l'agenda."]);
  });
  it("plus de 4 créneaux : les autres sont comptés", () => {
    const slots = Array.from({ length: 6 }, (_, i) => ({ title: `T${i}`, start: `2026-10-20T0${i + 1}:00:00Z`, end: null }));
    expect(dayBriefing({ slots, reminders: [], pendingChecks: 0 }).lines[0]).toMatch(/et 2 autres\.$/);
  });
});

describe("sommeil calculé en code", () => {
  it("durée entre le coucher et le lever, minuit franchi", () => {
    expect(sleepHours("23:30", "07:00")).toBe(7.5);
    expect(sleepHours("01:00", "08:00")).toBe(7);
    expect(sleepHours("22:45", "06:30")).toBe(7.75);
  });
  it("heures absurdes refusées", () => {
    expect(sleepHours("23:00", "23:00")).toBeNull();
    expect(sleepHours("23:00", "23:30")).toBeNull(); // 30 min
    expect(sleepHours("25:00", "07:00")).toBeNull();
    expect(sleepHours(undefined, "07:00")).toBeNull();
  });
  it("boutons − / + au quart d'heure, minuit franchi", () => {
    expect(shiftHm("23:45", 15)).toBe("00:00");
    expect(shiftHm("00:00", -15)).toBe("23:45");
  });
  it("habitudes : médiane des dernières nuits, couchers après minuit comptés après 23 h ; défaut sans nuit connue", () => {
    expect(sleepHabit([])).toEqual({ bed: "23:00", wake: "07:00" });
    expect(sleepHabit([{ date: "2026-10-19", bed_time: "23:30", wake_time: "07:00" }, { date: "2026-10-18", bed_time: "23:30", wake_time: "07:15" }, { date: "2026-10-17", bed_time: "23:00", wake_time: "07:00" }])).toEqual({ bed: "23:30", wake: "07:00" });
    expect(sleepHabit([{ date: "2026-10-19", bed_time: "00:30", wake_time: "08:00" }, { date: "2026-10-18", bed_time: "23:30", wake_time: "08:00" }, { date: "2026-10-17", bed_time: "00:00", wake_time: "08:00" }])).toEqual({ bed: "00:00", wake: "08:00" });
  });
});
