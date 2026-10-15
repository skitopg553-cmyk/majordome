import { describe, expect, it } from "vitest";
import { dayLabel, groupOf } from "./task-groups";

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
