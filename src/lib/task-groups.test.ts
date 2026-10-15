import { describe, expect, it } from "vitest";
import { addDays, dayLabel, groupOf, nextDays, parisIso, postponeToTomorrow } from "./task-groups";

const now = new Date("2026-10-15T20:00:00+02:00"); // jeudi 20 h à Paris

describe("groupOf", () => {
  it("classe par échéance sur le calendrier de Paris", () => {
    expect(groupOf(null, now)).toBe("Sans date");
    expect(groupOf("2026-10-15T09:00:00+02:00", now)).toBe("En retard");
    expect(groupOf("2026-10-15T23:30:00+02:00", now)).toBe("Aujourd'hui");
    expect(groupOf("2026-10-16T00:30:00+02:00", now)).toBe("Demain"); // déjà demain à Paris, encore le 15 en UTC
    expect(groupOf("2026-10-16T22:00:00+02:00", now)).toBe("Demain");
    expect(groupOf("2026-10-17T09:00:00+02:00", now)).toBe("Plus tard");
  });

  it("gère le passage à l'heure d'hiver", () => {
    expect(groupOf("2026-10-25T09:00:00+01:00", new Date("2026-10-24T20:00:00+02:00"))).toBe("Demain");
  });
});

describe("dayLabel", () => {
  it("donne Aujourd'hui, Demain ou la date en toutes lettres", () => {
    expect(dayLabel("2026-10-15", now)).toBe("Aujourd'hui");
    expect(dayLabel("2026-10-16", now)).toBe("Demain");
    expect(dayLabel("2026-10-17", now)).toBe("samedi 17 octobre");
  });
});

describe("parisIso / addDays / nextDays", () => {
  it("convertit une heure de Paris en instant, été comme hiver", () => {
    expect(parisIso("2026-10-16", 9, 0)).toBe("2026-10-16T07:00:00.000Z"); // été : UTC+2
    expect(parisIso("2026-10-26", 9, 0)).toBe("2026-10-26T08:00:00.000Z"); // hiver : UTC+1
  });
  it("décale les jours en traversant les mois", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(nextDays(now, 3)).toEqual(["2026-10-15", "2026-10-16", "2026-10-17"]);
  });
});

describe("postponeToTomorrow", () => {
  it("garde l'heure et passe à demain", () => {
    expect(postponeToTomorrow("2026-10-15T14:30:00+02:00", now)).toBe("2026-10-16T12:30:00.000Z");
  });
  it("une tâche en retard de plusieurs jours part à demain (pas au lendemain de son échéance)", () => {
    expect(postponeToTomorrow("2026-10-10T08:00:00+02:00", now)).toBe("2026-10-16T06:00:00.000Z");
  });
  it("sans échéance : demain 9 h", () => {
    expect(postponeToTomorrow(null, now)).toBe("2026-10-16T07:00:00.000Z");
  });
  it("garde l'heure locale à travers le passage à l'heure d'hiver", () => {
    expect(postponeToTomorrow("2026-10-24T10:00:00+02:00", new Date("2026-10-24T20:00:00+02:00"))).toBe("2026-10-25T09:00:00.000Z");
  });
});
