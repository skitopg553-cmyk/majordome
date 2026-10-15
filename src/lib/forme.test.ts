import { describe, expect, it } from "vitest";
import { hoursLabel, isWorkoutTitle, mondayOf, weekStats } from "./forme";

describe("isWorkoutTitle", () => {
  it.each(["Salle 18h", "Séance de sport", "Footing avec Léa", "Muscu jambes", "Basic-Fit", "Five avec les potes", "Yoga", "Course à pied 10 km", "Padel", "Piscine"])(
    "« %s » est du sport",
    (t) => expect(isWorkoutTitle(t)).toBe(true),
  );
  it.each(["Courses Carrefour", "Salle de réunion B", "Réunion client", "Dentiste", "Point projet", "Football à la télé", "Anniversaire de Sarah", "Bloc-notes"])(
    "« %s » n'est pas du sport",
    (t) => expect(isWorkoutTitle(t)).toBe(false),
  );
});

describe("mondayOf", () => {
  it("donne le lundi de la semaine, calendrier de Paris", () => {
    expect(mondayOf(new Date("2026-10-15T20:00:00+02:00"))).toBe("2026-10-12"); // jeudi
    expect(mondayOf(new Date("2026-10-18T23:30:00+02:00"))).toBe("2026-10-12"); // dimanche soir
    expect(mondayOf(new Date("2026-10-19T00:30:00+02:00"))).toBe("2026-10-19"); // lundi 0 h 30 à Paris (dimanche en UTC)
  });
});

describe("weekStats", () => {
  const now = new Date("2026-10-15T20:00:00+02:00"); // semaine du 12 au 18
  it("compte jours actifs, séances et sommeil de la semaine seulement", () => {
    const s = weekStats(
      [
        { date: "2026-10-12", kind: "Salle", minutes: 60 },
        { date: "2026-10-12", kind: "Footing", minutes: 20 }, // 2 séances, 1 seul jour actif
        { date: "2026-10-14", kind: "Padel", minutes: 90 },
        { date: "2026-10-11", kind: "Salle", minutes: 60 }, // semaine précédente
      ],
      [
        { date: "2026-10-13", hours: 7 },
        { date: "2026-10-14", hours: 6.5 },
        { date: "2026-10-10", hours: 9 }, // hors semaine
      ],
      now,
    );
    expect(s.active).toEqual([true, false, true, false, false, false, false]);
    expect(s.sessions).toBe(3);
    expect(s.activeDays).toBe(2);
    expect(s.avgSleep).toBeCloseTo(6.75);
    expect(hoursLabel(s.avgSleep!)).toBe("6 h 45");
    expect(s.nightsLogged).toBe(2);
  });
  it("sans donnée : rien d'inventé", () => {
    const s = weekStats([], [], now);
    expect(s.activeDays).toBe(0);
    expect(s.avgSleep).toBeNull();
  });
});

describe("hoursLabel", () => {
  it("formate les heures", () => {
    expect(hoursLabel(7.2)).toBe("7 h 12");
    expect(hoursLabel(8)).toBe("8 h 00");
    expect(hoursLabel(6.999)).toBe("7 h 00");
  });
});
